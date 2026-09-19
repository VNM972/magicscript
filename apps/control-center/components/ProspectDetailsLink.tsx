"use client";

import { useState } from "react";

export const PROSPECT_DETAILS_PREFIX = "prospect-";

export function openProspectDetails(prospectId: string): boolean {
  const target = document.getElementById(`${PROSPECT_DETAILS_PREFIX}${prospectId}`);
  if (!(target instanceof HTMLDetailsElement)) return false;

  target.open = true;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

export default function ProspectDetailsLink({ prospectId }: { prospectId: string }) {
  const [missingTarget, setMissingTarget] = useState(false);
  const href = `#${PROSPECT_DETAILS_PREFIX}${prospectId}`;

  return (
    <>
      <a
        className="actionLink"
        href={href}
        onClick={(event) => {
          event.preventDefault();
          setMissingTarget(!openProspectDetails(prospectId));
        }}
      >
        Voir le prospect
      </a>
      {missingTarget ? (
        <small className="prospectActionNote" role="status">
          Prospect indisponible dans le pipeline · aucune action effectuée
        </small>
      ) : null}
    </>
  );
}
