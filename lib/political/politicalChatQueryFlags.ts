/** NL query flags — shared by /api/political-chat and collectDataPrecinctIdsForQuery. */

export function wantsTurnoutTrendQuery(q: string): boolean {
  const isTurnoutTopic =
    /\b(turnout|voting|participation|ballots?\s+cast|voter\s+participation)\b/i.test(q);
  const isTrendTopic =
    /\b(trend|trends|changed|change|more|less|than\s+before|historical|year|years|over\s+time|compared)\b/i.test(
      q
    );
  return isTurnoutTopic && isTrendTopic;
}

export function wantsElectionShiftQuery(q: string): boolean {
  return (
    /\b(precincts?|which\s+areas?|where|areas?)\b/i.test(q) &&
    /\b(shift|shifted|dramatic|volatile|volatility|swing|changed|movement)\b/i.test(q) &&
    /\b(election|2020|2022|2024|last\s+3|three\s+elections?|past\s+3|over\s+time)\b/i.test(q)
  );
}

export function wantsCanvassingEfficiencyQuery(q: string): boolean {
  return (
    /\b(canvass|canvassing|doors?|door\s+knock)\b/i.test(q) &&
    /\b(efficiency|persuadable|per\s+voter|rank)\b/i.test(q)
  );
}
