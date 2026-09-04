import {
  DESIGN_SYSTEM_HUB,
  SWARM_HUBS,
  resolveSwarmHub,
} from '@magicscript/core';
import type { Job, ProspectSummary } from '../lib/api';

interface HubControlPlaneProps {
  prospects: ProspectSummary[];
  runningJobs: Job[];
}

export default function HubControlPlane({
  prospects,
  runningJobs,
}: HubControlPlaneProps) {
  const rows = SWARM_HUBS.map((hub) => {
    const members = prospects.filter(
      (prospect) => resolveSwarmHub(prospect).id === hub.id,
    );
    const activeJobs = runningJobs.filter(
      (job) => job.prospectId && members.some((prospect) => prospect.id === job.prospectId),
    );

    return { hub, members, activeJobs };
  });

  return (
    <section className="hubPlane" aria-labelledby="hub-plane-title">
      <div className="hubPlaneHeader">
        <div>
          <p className="eyebrow">HUB CONTROL PLANE</p>
          <h3 id="hub-plane-title">Les maîtres d’œuvre organisent la ruche</h3>
          <p>
            Chaque prospect reste visible dans la ruche, mais son analyse est
            orientée vers un hub métier à capacité bornée.
          </p>
        </div>
        <div className="hubPlaneTransversal">
          <span className="hubCardKicker">TRANSVERSE</span>
          <strong>{DESIGN_SYSTEM_HUB.masterOfWork}</strong>
          <small>{DESIGN_SYSTEM_HUB.businessUnit} · Patterns, mobile, accessibilité, tendances</small>
        </div>
      </div>

      <div className="hubGrid">
        {rows.map(({ hub, members, activeJobs }) => (
          <article className="hubCard" key={hub.id}>
            <div className="hubCardTopline">
              <span className="hubCardSignal" />
              <span className="hubCardKicker">MO HUB</span>
              <span className="hubCardCapacity">MAX {hub.concurrencyCap}</span>
            </div>
            <strong>{hub.label}</strong>
            <span className="hubCardBusinessUnit">{hub.businessUnit}</span>
            <span className="hubCardMaster">{hub.masterOfWork}</span>
            <div className="hubCardStats">
              <span>{members.length} prospect{members.length > 1 ? 's' : ''}</span>
              <span>{activeJobs.length} actif{activeJobs.length > 1 ? 's' : ''}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
