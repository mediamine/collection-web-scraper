export const isPageTextScanV2ExcludedConditions = (link: string) => !/https[^\s]+https[^\s]+/.test(link);
