import { Canvas, Spinner } from 'datocms-react-ui';
import { buildClient } from '@datocms/cma-client-browser';
import type { RenderPageCtx } from 'datocms-plugin-sdk';
import { useEffect, useState } from 'react';
import s from './styles.module.css';

interface CollaboratorInfo {
  id: string;
  name: string;
  role: string;
  lastAccess: string | null;
  lastUpdate?: { recordId: string; occurredAt: string };
  lastPublish?: { recordId: string; occurredAt: string; action: string };
}

export default function DatoBlamePage({ ctx }: { ctx: RenderPageCtx }) {
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[] | null>(null);

  useEffect(() => {
    async function load() {
      if (!ctx.currentUserAccessToken) {
        setCollaborators([]);
        return;
      }

      const client = buildClient({ apiToken: ctx.currentUserAccessToken });
      const users = await client.users.list();

      const infos: CollaboratorInfo[] = await Promise.all(
        users.map(async (user) => {
          let lastUpdate;
          let lastPublish;
          try {
            const updateEvents = await client.auditLogEvents.query({
              filter: `actor.id = '${user.id}' AND action_name = 'update' AND request.path ~ '/items/'`,
            });
            if (updateEvents.length > 0) {
              lastUpdate = {
                recordId: updateEvents[0].request.path.split('/').pop() || '',
                occurredAt: updateEvents[0].meta.occurred_at,
              };
            }
          } catch {
            // ignore
          }
          try {
            const publishEvents = await client.auditLogEvents.query({
              filter: `actor.id = '${user.id}' AND action_name IN ('publish', 'unpublish') AND request.path ~ '/items/'`,
            });
            if (publishEvents.length > 0) {
              lastPublish = {
                recordId: publishEvents[0].request.path.split('/').pop() || '',
                occurredAt: publishEvents[0].meta.occurred_at,
                action: publishEvents[0].action_name,
              };
            }
          } catch {
            // ignore
          }

          let roleName = '';
          if (user.role) {
            try {
              const role = await client.roles.find(user.role.id);
              roleName = role.name;
            } catch {
              roleName = '';
            }
          }

          return {
            id: user.id,
            name: user.full_name || user.email,
            role: roleName,
            lastAccess: user.meta?.last_access || null,
            lastUpdate,
            lastPublish,
          } as CollaboratorInfo;
        })
      );
      setCollaborators(infos);
    }
    load();
  }, [ctx]);

  if (!collaborators) {
    return (
      <Canvas ctx={ctx}>
        <Spinner /> Loading...
      </Canvas>
    );
  }

  return (
    <Canvas ctx={ctx}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Role</th>
            <th>Name</th>
            <th>Last login</th>
            <th>Last updated record</th>
            <th>Last publish/unpublish</th>
          </tr>
        </thead>
        <tbody>
          {collaborators.map((c) => (
            <tr key={c.id}>
              <td>{c.role}</td>
              <td>{c.name}</td>
              <td>{c.lastAccess ? new Date(c.lastAccess).toLocaleString() : 'Never'}</td>
              <td>
                {c.lastUpdate
                  ? `#${c.lastUpdate.recordId} (${new Date(c.lastUpdate.occurredAt).toLocaleString()})`
                  : '—'}
              </td>
              <td>
                {c.lastPublish
                  ? `${c.lastPublish.action} #${c.lastPublish.recordId} (${new Date(
                      c.lastPublish.occurredAt
                    ).toLocaleString()})`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Canvas>
  );
}
