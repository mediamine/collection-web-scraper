export const isPageTextScanExcludedConditions = (link: string) => !['https://businessdesk.co.nz/journalist/'].some((d) => link.includes(d));
