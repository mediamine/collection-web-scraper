// Only the delegates the workflows touch. findMany and $queryRaw default to no rows, so a spec only has
// to stub the passes it cares about.
export const createMockPrisma = () => ({
  feed: {
    findUnique: jest.fn(),
    update: jest.fn()
  },
  news_item: {
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn()
  },
  // Called as a tagged template, so a call's arguments are (strings, ...interpolated values)
  $queryRaw: jest.fn().mockResolvedValue([])
});

export type MockPrisma = ReturnType<typeof createMockPrisma>;
