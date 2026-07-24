/**
 * ConflictResolver - Detect dan resolve conflicts saat sync
 * 
 * Conflict types:
 * - Deleted on server: item offline tapi dihapus di server
 * - Version conflict: item berubah baik offline maupun online
 * - Duplicate: item yang sama upload 2x
 * 
 * Resolution strategy: Server-authoritative (server always wins)
 */

class ConflictResolver {
  constructor() {
    this.resolutionStrategies = {
      'server-authoritative': 'Use server version (safest)',
      'last-write-wins': 'Use version with newest timestamp',
      'merge': 'Merge both versions intelligently'
    };
  }

  /**
   * Detect conflicts antara local dan server data
   */
  async detectConflicts(localData, serverData) {
    if (!Array.isArray(localData)) localData = [localData];
    if (!Array.isArray(serverData)) serverData = [serverData];

    const conflicts = [];
    const processed = new Set();

    // Check local items against server
    for (const localItem of localData) {
      const itemId = localItem.id || localItem.id_produk || localItem.id_pelanggan;
      
      if (!itemId) {
        console.warn('Item tanpa ID, skip conflict check:', localItem);
        continue;
      }

      processed.add(itemId);
      const serverItem = serverData.find(s => 
        (s.id === itemId) || 
        (s.id_produk === itemId) || 
        (s.id_pelanggan === itemId)
      );

      if (!serverItem) {
        // Item ada di local tapi tidak di server - dihapus di server
        conflicts.push({
          type: 'deleted_on_server',
          localId: itemId,
          local: localItem,
          server: null,
          timestamp: new Date().toISOString(),
          severity: 'high'
        });
      } else {
        // Item ada di kedua tempat - check version
        const localUpdated = new Date(localItem.updated_at || localItem.createdAt || 0).getTime();
        const serverUpdated = new Date(serverItem.updated_at || serverItem.createdAt || 0).getTime();

        if (localUpdated !== serverUpdated) {
          conflicts.push({
            type: 'version_conflict',
            itemId,
            local: localItem,
            server: serverItem,
            localVersion: localUpdated,
            serverVersion: serverUpdated,
            timestamp: new Date().toISOString(),
            severity: 'medium',
            winner: serverUpdated > localUpdated ? 'server' : 'local'
          });
        }

        // Check for duplicate uploads
        const localHash = this.generateHash(localItem);
        const serverHash = this.generateHash(serverItem);

        if (localHash === serverHash) {
          conflicts.push({
            type: 'duplicate',
            itemId,
            local: localItem,
            server: serverItem,
            timestamp: new Date().toISOString(),
            severity: 'low'
          });
        }
      }
    }

    // Check server items yang tidak ada di local
    for (const serverItem of serverData) {
      const itemId = serverItem.id || serverItem.id_produk || serverItem.id_pelanggan;
      if (!itemId) continue;

      if (!processed.has(itemId)) {
        const localItem = localData.find(l => 
          (l.id === itemId) || 
          (l.id_produk === itemId) || 
          (l.id_pelanggan === itemId)
        );

        if (!localItem) {
          // Server items yang baru (tidak conflict, tapi info)
          conflicts.push({
            type: 'new_on_server',
            itemId,
            local: null,
            server: serverItem,
            timestamp: new Date().toISOString(),
            severity: 'info'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflicts dengan strategy tertentu
   */
  async resolveConflicts(conflicts, strategy = 'server-authoritative') {
    if (!Array.isArray(conflicts)) conflicts = [conflicts];

    const resolved = [];
    const deletions = [];

    for (const conflict of conflicts) {
      let result = null;

      switch (conflict.type) {
        case 'deleted_on_server':
          // Item dihapus di server, delete dari local juga
          deletions.push(conflict.local);
          break;

        case 'version_conflict':
          if (strategy === 'server-authoritative') {
            result = conflict.server;
          } else if (strategy === 'last-write-wins') {
            result = conflict.winner === 'server' ? conflict.server : conflict.local;
          } else if (strategy === 'merge') {
            result = this.mergeVersions(conflict.local, conflict.server);
          }
          break;

        case 'duplicate':
          // Sudah sama, skip (tidak perlu update)
          break;

        case 'new_on_server':
          // Item baru dari server, terima saja
          result = conflict.server;
          break;

        default:
          console.warn('Unknown conflict type:', conflict.type);
      }

      if (result) {
        resolved.push(result);
      }
    }

    return {
      resolved,
      deletions,
      total: resolved.length,
      summary: {
        conflictCount: conflicts.length,
        resolvedCount: resolved.length,
        deletionCount: deletions.length,
        strategy
      }
    };
  }

  /**
   * Merge two versions intelligently
   */
  mergeVersions(local, server) {
    // Strategy: Use all fields dari server, tapi overlay local changes yang lebih baru
    const merged = { ...server };

    // Find fields yang lebih baru di local
    for (const key of Object.keys(local)) {
      const localUpdatedKey = `${key}_updated_at`;
      const serverUpdatedKey = `${key}_updated_at`;

      if (local[localUpdatedKey] && server[serverUpdatedKey]) {
        const localTime = new Date(local[localUpdatedKey]).getTime();
        const serverTime = new Date(server[serverUpdatedKey]).getTime();

        if (localTime > serverTime) {
          merged[key] = local[key];
        }
      }
    }
    return merged;
  }

  /**
   * Generate hash untuk detect duplicates
   */
  generateHash(data) {
    const json = JSON.stringify(data);
    let hash = 0;

    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Get conflict statistics
   */
  getConflictStats(conflicts) {
    const stats = {
      total: conflicts.length,
      byType: {},
      bySeverity: { high: 0, medium: 0, low: 0, info: 0 },
      critical: []
    };

    conflicts.forEach(c => {
      stats.byType[c.type] = (stats.byType[c.type] || 0) + 1;
      stats.bySeverity[c.severity] = (stats.bySeverity[c.severity] || 0) + 1;

      if (c.severity === 'high') {
        stats.critical.push(c);
      }
    });

    return stats;
  }

  /**
   * Prepare conflict report untuk display
   */
  generateConflictReport(conflicts) {
    const stats = this.getConflictStats(conflicts);

    return {
      timestamp: new Date().toISOString(),
      summary: `${stats.total} conflicts found`,
      stats,
      details: conflicts.map(c => ({
        id: c.itemId || c.localId,
        type: c.type,
        severity: c.severity,
        description: this.getConflictDescription(c),
        recommendation: this.getConflictRecommendation(c)
      }))
    };
  }

  /**
   * Get human-readable description
   */
  getConflictDescription(conflict) {
    const descriptions = {
      'deleted_on_server': 'Item deleted on server but exists locally',
      'version_conflict': 'Item modified both offline and online',
      'duplicate': 'Item uploaded multiple times',
      'new_on_server': 'New item found on server'
    };
    return descriptions[conflict.type] || 'Unknown conflict';
  }

  /**
   * Get recommendation untuk resolve
   */
  getConflictRecommendation(conflict) {
    const recommendations = {
      'deleted_on_server': 'Use server version (delete locally)',
      'version_conflict': 'Use latest version (server-authoritative)',
      'duplicate': 'Skip (already synced)',
      'new_on_server': 'Accept new version'
    };
    return recommendations[conflict.type] || 'Review manually';
  }
}

// Singleton instance
const conflictResolver = new ConflictResolver();

export default conflictResolver;
export { ConflictResolver };
