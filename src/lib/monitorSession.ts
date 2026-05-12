import prisma from '@/lib/prisma';

export async function verifyMonitorSessionToken(token: string | null): Promise<boolean> {
  if (!token) return false;

  const session = await prisma.sessionToken.findUnique({
    where: { token },
  });

  if (!session) return false;

  if (session.expiresAt < new Date()) {
    await prisma.sessionToken.delete({
      where: { id: session.id },
    });
    return false;
  }

  return true;
}
