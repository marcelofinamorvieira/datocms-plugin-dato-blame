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
  itemType: string;
  title: string;
  url: string;
}

interface PublishInfo {
  recordId: string;
  occurredAt: string;
  action: string;
  itemType: string;
  title: string;
  url: string;
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

      const itemTypes = await client.itemTypes.list();
      const itemTypeMap = new Map<string, any>(
        itemTypes.map((t: any) => [String(t.id), t])
      );

      const internalDomain = ctx.site.attributes.internal_domain;

      const updatedItemsArrays = await Promise.all(
        itemTypes.map((type) =>
          client.items.list({
            filter: { type: type.id },
            order_by: '_updated_at_DESC',
            page: { limit: 10 },
            version: 'current',
          })
        )
      );

      const allUpdatedItems = updatedItemsArrays.flat();
      allUpdatedItems.sort(
        (a, b) =>
          new Date(b.meta.updated_at).getTime() -
          new Date(a.meta.updated_at).getTime()
      );
      const topUpdates = allUpdatedItems.slice(0, 10);

      const publishedItemsArrays = await Promise.all(
        itemTypes.map((type) =>
          client.items.list({
            filter: { type: type.id },
            order_by: '_updated_at_DESC',
            page: { limit: 10 },
            version: 'current',
          })
        )
      );

      const publishCandidates = publishedItemsArrays
        .flat()
        .filter((item) => item.meta.first_published_at);

      publishCandidates.sort(
        (a, b) =>
          new Date(b.meta.updated_at).getTime() -
          new Date(a.meta.updated_at).getTime()
      );

      const topPublishes = publishCandidates.slice(0, 10);

      const relevantItemTypeIds = new Set<string>();
      topUpdates.forEach((item) => relevantItemTypeIds.add(String(item.item_type.id)));
      topPublishes.forEach((item) => relevantItemTypeIds.add(String(item.item_type.id)));
      await Promise.all(
        Array.from(relevantItemTypeIds).map((id) => ctx.loadItemTypeFields(id))
      );

      setRecentUpdates(
        topUpdates.map((item) => {
          const type = itemTypeMap.get(String(item.item_type.id)) as any;
          const titleFieldId =
            type?.relationships?.title_field?.data?.id ||
            type?.relationships?.presentation_title_field?.data?.id;
          const fieldApiKey =
            titleFieldId ? ctx.fields[titleFieldId]?.attributes.api_key : undefined;
          const title = fieldApiKey && item[fieldApiKey] ? String(item[fieldApiKey]) : '';
          return {
            recordId: String(item.id),
            occurredAt: item.meta.updated_at,
            itemType: type?.attributes?.name || type?.name || '',
            title,
            url: `https://${internalDomain}/editor/items/${item.id}`,
          } as UpdateInfo;
        })
      );

      setRecentPublishes(
        topPublishes.map((item) => {
          const type = itemTypeMap.get(String(item.item_type.id)) as any;
          const titleFieldId =
            type?.relationships?.title_field?.data?.id ||
            type?.relationships?.presentation_title_field?.data?.id;
          const fieldApiKey =
            titleFieldId ? ctx.fields[titleFieldId]?.attributes.api_key : undefined;
          const title = fieldApiKey && item[fieldApiKey] ? String(item[fieldApiKey]) : '';
          return {
            recordId: String(item.id),
            occurredAt: item.meta.updated_at,
            action: item.meta.published_at ? 'publish' : 'unpublish',
            itemType: type?.attributes?.name || type?.name || '',
            title,
            url: `https://${internalDomain}/editor/items/${item.id}`,
          } as PublishInfo;
        })
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
                  <a href={u.url} target="_blank" rel="noopener noreferrer">
                    {u.itemType}: {u.title || 'Untitled'}
                  </a>{' '}
                  ({new Date(u.occurredAt).toLocaleString()})
                </li>
              ))}
            </ul>
          </div>
          <div className={s.column}>
            <h3>Last publish/unpublish</h3>
            <ul className={s.list}>
              {recentPublishes.map((p) => (
                <li key={`${p.recordId}-${p.occurredAt}`}>
                  {p.action}{' '}
                  <a href={p.url} target="_blank" rel="noopener noreferrer">
                    {p.itemType}: {p.title || 'Untitled'}
                  </a>{' '}
                  ({new Date(p.occurredAt).toLocaleString()})
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Canvas>
  );
}
