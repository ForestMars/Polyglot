// src/utils/syncUtils.ts

export function mapToWire(resources: ChatResource[], deletions: DeletionRecord[]) {
  return {
    chats: resources.map(r => ({
      ...r,
      updatedAtLamport: [r.lastMutationLamport.lamport, r.lastMutationLamport.deviceId],
    })),
    deletionRecords: deletions.map(d => ({
      id: d.id,
      deletedAtLamport: [d.deletedAtLamport.lamport, d.deletedAtLamport.deviceId],
    })),
  };
}

export function mapFromWire(apiMissing: any[], apiDeletions: any[]) {
  const resources: ChatResource[] = (apiMissing || []).map(c => ({
    ...c,
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
    lastModified: new Date(c.lastModified || c.updatedAt),
    messages: (c.messages || []).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
    lastMutationLamport: c.updatedAtLamport
      ? { lamport: c.updatedAtLamport[0], deviceId: c.updatedAtLamport[1] }
      : { lamport: 0, deviceId: 'server' },
  }));

  const deletions: DeletionRecord[] = (apiDeletions || []).map(d => ({
    id: d.id,
    deletedAtLamport: { lamport: d.deletedAtLamport[0], deviceId: d.deletedAtLamport[1] },
  }));

  return { resources, deletions };
}