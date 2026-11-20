import type { Database } from '../../database.js';

export async function readPublicProfiles(database: Pick<Database, 'profile'>, userIds: string[]) {
    if (!userIds.length) return new Map<string, { name: string; photoUrl: string }>();
    const profiles = await database.profile.findMany({ where: { userId: { in: userIds } }, select: { userId: true, name: true, photoUrl: true } });
    return new Map(profiles.map(({ userId, ...profile }) => [userId, profile]));
}
