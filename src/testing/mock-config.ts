// Mirrors ConfigService.get(key, defaultValue): an unset key falls back to the default, if one is given.
export const createMockConfig = (values: Record<string, string | undefined> = {}) => ({
  get: jest.fn((key: string, defaultValue?: unknown) => values[key] ?? defaultValue)
});

export type MockConfig = ReturnType<typeof createMockConfig>;
