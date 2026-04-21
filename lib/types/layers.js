"use strict";
// src/types/layers.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.layerGroups = exports.layers = void 0;
// Helper function to create a layer configuration
function createLayerConfig(id, name, url, rendererField, group) {
    return {
        id: id,
        name: name,
        type: 'amount',
        url: url,
        rendererField: rendererField,
        group: group,
        status: 'active',
        geographicType: 'census',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: rendererField, type: 'double', alias: name, label: name }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            geographicType: 'census',
            geographicLevel: 'local'
        },
        processing: {},
        caching: {},
        performance: {},
        security: {},
        description: name,
        isVisible: true
    };
}
exports.layers = [
    // Demographics Group
    createLayerConfig('total-population', 'Total Population', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/7', 'Total_Population', 'demographics-group'),
    createLayerConfig('married-common-law', 'Married or living with a common-law partner', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/8', 'Married_or_living_with_a_common_law_partner', 'demographics-group'),
    createLayerConfig('single-never-married', 'Single (never married)', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/9', 'Single_never_married', 'demographics-group'),
    createLayerConfig('separated-divorced-widowed', 'Separated, divorced or widowed', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/10', 'Separated_divorced_or_widowed', 'demographics-group'),
    createLayerConfig('total-private-households', 'Total private households', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/11', 'Total_private_households', 'housing-group'),
    createLayerConfig('household-size-1-person', 'Household size: 1 person', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/12', 'Household_size_1_person', 'housing-group'),
    createLayerConfig('household-size-2-persons', 'Household size: 2 persons', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/13', 'Household_size_2_persons', 'housing-group'),
    createLayerConfig('household-size-3-persons', 'Household size: 3 persons', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/14', 'Household_size_3_persons', 'housing-group'),
    createLayerConfig('household-size-4-persons', 'Household size: 4 persons', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/15', 'Household_size_4_persons', 'housing-group'),
    createLayerConfig('household-size-5-persons', 'Household size: 5 or more persons', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/16', 'Household_size_5_or_more_persons', 'housing-group'),
    createLayerConfig('total-household-income', 'Total household income', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/17', 'Total_household_income', 'income-group'),
    createLayerConfig('household-income-under-50k', 'Household income: Under $50,000', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/18', 'Household_income_Under_50_000', 'income-group'),
    createLayerConfig('household-income-50k-to-100k', 'Household income: $50,000 to $100,000', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/19', 'Household_income_50_000_to_100_000', 'income-group'),
    createLayerConfig('household-income-100k-to-150k', 'Household income: $100,000 to $150,000', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/20', 'Household_income_100_000_to_150_000', 'income-group'),
    createLayerConfig('household-income-150k-to-200k', 'Household income: $150,000 to $200,000', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/21', 'Household_income_150_000_to_200_000', 'income-group'),
    createLayerConfig('household-income-over-200k', 'Household income: $200,000 and over', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/22', 'Household_income_200_000_and_over', 'income-group'),
    createLayerConfig('total-household-spending', 'Total household spending', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/23', 'Total_household_spending', 'spending-group'),
    createLayerConfig('food-spending', 'Food spending', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/24', 'Food_spending', 'spending-group'),
    createLayerConfig('shelter-spending', 'Shelter spending', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/25', 'Shelter_spending', 'spending-group'),
    createLayerConfig('transportation-spending', 'Transportation spending', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/26', 'Transportation_spending', 'spending-group'),
    createLayerConfig('clothing-spending', 'Clothing spending', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/27', 'Clothing_spending', 'spending-group'),
    createLayerConfig('healthcare-spending', 'Healthcare spending', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/28', 'Healthcare_spending', 'spending-group'),
    createLayerConfig('recreation-spending', 'Recreation spending', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/29', 'Recreation_spending', 'spending-group'),
    createLayerConfig('education-spending', 'Education spending', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/30', 'Education_spending', 'spending-group'),
    createLayerConfig('personal-care-spending', 'Personal care spending', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/31', 'Personal_care_spending', 'spending-group'),
    createLayerConfig('reading-spending', 'Reading spending', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/32', 'Reading_spending', 'spending-group'),
    createLayerConfig('tobacco-alcohol-spending', 'Tobacco products and alcoholic beverages spending', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/33', 'Tobacco_products_and_alcoholic_beverages_spending', 'spending-group'),
    createLayerConfig('miscellaneous-spending', 'Miscellaneous spending', 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/34', 'Miscellaneous_spending', 'spending-group')
];
exports.layerGroups = [
    {
        id: 'demographics-group',
        title: 'Demographics',
        description: 'Population and demographic data',
        layers: exports.layers.filter(function (layer) { return layer.group === 'demographics-group'; })
    },
    {
        id: 'housing-group',
        title: 'Housing',
        description: 'Housing and dwelling data',
        layers: exports.layers.filter(function (layer) { return layer.group === 'housing-group'; })
    },
    {
        id: 'income-group',
        title: 'Income',
        description: 'Household income data',
        layers: exports.layers.filter(function (layer) { return layer.group === 'income-group'; })
    },
    {
        id: 'spending-group',
        title: 'Spending',
        description: 'Household spending data',
        layers: exports.layers.filter(function (layer) { return layer.group === 'spending-group'; })
    }
];
