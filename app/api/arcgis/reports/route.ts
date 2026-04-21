// route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studyArea, studyAreas: studyAreasBody, reportTemplate } = body;

    const token = (process.env.NEXT_PUBLIC_ARCGIS_API_KEY || '').trim();

    if (!token) {
      return NextResponse.json(
        {
          error: 'Missing API key',
          details:
            'Set NEXT_PUBLIC_ARCGIS_API_KEY in .env.local and restart the dev server (or redeploy).',
        },
        { status: 400 },
      );
    }

    const studyAreas =
      Array.isArray(studyAreasBody) && studyAreasBody.length > 0
        ? studyAreasBody
        : studyArea
          ? [studyArea]
          : [];

    if (studyAreas.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request', details: 'Missing studyArea or studyAreas' },
        { status: 400 },
      );
    }

    // Format the request data
    const formData = new URLSearchParams();
    formData.append('f', 'json');
    formData.append('token', token);
    formData.append('report', reportTemplate);
    formData.append('format', 'html');
    formData.append('studyAreas', JSON.stringify(studyAreas));
    formData.append('langCode', 'en-us');
    // US / PA: pin country + hierarchy so enrichment uses US census-style data (faster + consistent)
    formData.append(
      'useData',
      JSON.stringify({ sourceCountry: 'US', hierarchy: 'esri2025' }),
    );

    // Make request to ArcGIS GeoEnrichment API
    const response = await axios.post(
      'https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/createreport',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }
    );

    // Handle both JSON and string (HTML) responses
    let reportHtml: string | null = null;

    if (typeof response.data === 'string') {
      // Response is HTML string directly
      if (response.data.includes('<html') || response.data.includes('<!DOCTYPE')) {
        reportHtml = response.data;
        console.log('ArcGIS response: HTML string, length:', response.data.length);
      } else {
        console.error('ArcGIS response is unexpected string:', response.data.substring(0, 500));
      }
    } else if (typeof response.data === 'object') {
      console.log('ArcGIS response keys:', Object.keys(response.data));

      if (response.data.error) {
        console.error('ArcGIS API error:', response.data.error);
        return NextResponse.json({
          error: 'ArcGIS API error',
          details: response.data.error.message || JSON.stringify(response.data.error)
        }, { status: 400 });
      }

      // Check multiple possible response formats
      reportHtml = response.data.results?.[0]?.value?.reportHtml ||
        response.data.results?.[0]?.reportHtml ||
        response.data.reportHtml;
    }

    if (!reportHtml) {
      return NextResponse.json({
        error: 'Invalid response',
        details: 'No report HTML in response'
      }, { status: 400 });
    }

    return NextResponse.json({ reportHtml });

  } catch (error) {
    console.error('Report generation error:', error);

    let errorMessage = 'Unknown error';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      if (axios.isAxiosError(error)) {
        if (error.response) {
          errorMessage = error.response.data?.error?.message || error.message;
          statusCode = error.response.status;
        }
      }
    }

    return NextResponse.json({
      error: 'Report generation failed',
      details: errorMessage
    }, { status: statusCode });
  }
}