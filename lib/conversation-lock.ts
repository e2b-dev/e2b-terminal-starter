const conversationLocks = new Map<string, Promise<unknown>>();

export async function withConversationLock<T>(
  conversationId: string,
  run: () => Promise<T>,
) {
  const previous = conversationLocks.get(conversationId) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const next = previous.then(
    () => current,
    () => current,
  );
  conversationLocks.set(conversationId, next);

  await previous.catch(() => undefined);
  try {
    return await run();
  } finally {
    release();
    if (conversationLocks.get(conversationId) === next) {
      conversationLocks.delete(conversationId);
    }
  }
}
