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
}

interface UpdateInfo {
  recordId: string;
  occurredAt: string;
}

interface PublishInfo {
  recordId: string;
  occurredAt: string;
  action: string;
}

export default function DatoBlamePage({ ctx }: { ctx: RenderPageCtx }) {
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[] | null>(null);
  const [recentUpdates, setRecentUpdates] = useState<UpdateInfo[]>([]);
  const [recentPublishes, setRecentPublishes] = useState<PublishInfo[]>([]);

  useEffect(() => {
    async function load() {
      if (!ctx.currentUserAccessToken) {
        setCollaborators([]);
        return;
      }

      const client = buildClient({ apiToken: ctx.currentUserAccessToken });

      let updateEvents: any[] = [];
      let publishEvents: any[] = [];
      try {
        updateEvents = await client.auditLogEvents.query({
          filter: `action_name = 'update' AND request.path ~ '/items/'`,
        });
      } catch {
        updateEvents = [];
      }
      try {
        publishEvents = await client.auditLogEvents.query({
          filter: `action_name IN ('publish', 'unpublish') AND request.path ~ '/items/'`,
        });
      } catch {
        publishEvents = [];
      }

      setRecentUpdates(
        updateEvents.slice(0, 10).map((ev) => ({
          recordId: ev.request.path.split('/').pop() || '',
          occurredAt: ev.meta.occurred_at,
        }))
      );

      setRecentPublishes(
        publishEvents.slice(0, 10).map((ev) => ({
          recordId: ev.request.path.split('/').pop() || '',
          occurredAt: ev.meta.occurred_at,
          action: ev.action_name,
        }))
      );

      const users = await client.users.list();

      const infos: CollaboratorInfo[] = await Promise.all(
        users.map(async (user) => {
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
      <div className={s.layout}>
        <div>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Role</th>
                <th>Name</th>
                <th>Last login</th>
              </tr>
            </thead>
            <tbody>
              {collaborators.map((c) => (
                <tr key={c.id}>
                  <td>{c.role}</td>
                  <td>{c.name}</td>
                  <td>{c.lastAccess ? new Date(c.lastAccess).toLocaleString() : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={s.activities}>
          <div className={s.column}>
            <h3>Last updated records</h3>
            <ul className={s.list}>
              {recentUpdates.map((u) => (
                <li key={`${u.recordId}-${u.occurredAt}`}>
                  #{u.recordId} ({new Date(u.occurredAt).toLocaleString()})
                </li>
              ))}
            </ul>
          </div>
          <div className={s.column}>
            <h3>Last publish/unpublish</h3>
            <ul className={s.list}>
              {recentPublishes.map((p) => (
                <li key={`${p.recordId}-${p.occurredAt}`}>
                  {p.action} #{p.recordId} ({new Date(p.occurredAt).toLocaleString()})
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Canvas>
  );
}
