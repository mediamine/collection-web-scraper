export const FEEDS_TO_IDS_COMPLETE_SCAN = 'FEEDS_TO_IDS_COMPLETE_SCAN';
export const FEEDS_TO_IDS_PAGE_TEXT_SCAN = 'FEEDS_TO_IDS_PAGE_TEXT_SCAN';
export const FEEDS_TO_IDS_PAGE_TEXT_SCAN_V2 = 'FEEDS_TO_IDS_PAGE_TEXT_SCAN_V2';
export const FEEDS_TO_IDS_RSS_SCAN = 'FEEDS_TO_IDS_RSS_SCAN';

export const WORKFLOW = 'WORKFLOW';
export const WORKFLOW_COMPLETE_SCAN = 'WORKFLOW_COMPLETE_SCAN';
export const WORKFLOW_PAGE_TEXT_SCAN = 'WORKFLOW_PAGE_TEXT_SCAN';
export const WORKFLOW_PAGE_TEXT_SCAN_V2 = 'WORKFLOW_PAGE_TEXT_SCAN_V2';
export const WORKFLOW_RSS_SCAN = 'WORKFLOW_RSS_SCAN';

// Page Text Scan V2 re-scrapes news items whose page text is shorter than this many characters,
// on top of the blank/null page text condition it shares with Page Text Scan. 0 disables it.
export const PAGE_TEXT_SCAN_V2_MIN_CHAR_COUNT = 'PAGE_TEXT_SCAN_V2_MIN_CHAR_COUNT';
