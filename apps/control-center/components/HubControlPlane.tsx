import { DESIGN_SYSTEM_HUB } from '@magicscript/core';
import {
  projectBusinessUnitVisibility,
  type Job,
  type ProspectSummary,
} from '../lib/api';

interface HubControlPlaneProps {
  prospects: ProspectSummary[];
  runningJobs: Job[];
}

export default function HubControlPlane({
  prospects,
  runningJobs,
}: HubControlPlaneProps) {
  const visibility = projectBusinessUnitVisibility(prospects, runningJobs);

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
        {[...visibility.rows, visibility.unknown].map((row) => (
          <article className={`hubCard${row.known ? '' : ' hubCardUnknown'}`} key={row.key}>
            <div className="hubCardTopline">
              <span className="hubCardSignal" />
              <span className="hubCardKicker">{row.known ? 'MO HUB' : 'VISIBILITÉ'}</span>
              <span className="hubCardCapacity">{row.known ? 'MAX 1' : 'NON CONFIRMÉ'}</span>
            </div>
            <strong>{row.label}</strong>
            <span className="hubCardBusinessUnit">{row.businessUnit}</span>
            <span className="hubCardMaster">{row.masterOfWork}</span>
            <div className="hubCardStats">
              <span>{row.prospectCount} prospect{row.prospectCount > 1 ? 's' : ''}</span>
              <span>{row.activeJobCount} actif{row.activeJobCount > 1 ? 's' : ''}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
