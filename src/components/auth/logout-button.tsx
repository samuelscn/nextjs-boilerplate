import { Button } from "@ginga/ui";

export function LogoutButton() {
  // Full document navigation also discards private browser Query caches.
  return <form method="post" action="/auth/logout"><Button type="submit" variant="outline">Sair</Button></form>;
}
