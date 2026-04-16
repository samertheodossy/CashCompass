/**
 * IIFE bundle entry: mounts RollingDebtPayoffDashboard for Apps Script HTML host.
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import RollingDebtPayoffDashboard, {
  demoRollingDebtPayoffDashboardData,
  type RollingDebtPayoffDashboardProps
} from './components/RollingDebtPayoffDashboard';
import { mapPlannerPayloadToRollingDebtPayoffDashboardData } from './components/mapPlannerPayloadToRollingDebtPayoffDashboardData';

declare global {
  interface Window {
    mapPlannerPayloadToRollingDebtPayoffDashboardData: typeof mapPlannerPayloadToRollingDebtPayoffDashboardData;
    demoRollingDebtPayoffDashboardData: typeof demoRollingDebtPayoffDashboardData;
    mountRollingDebtPayoffDashboard: (
      container: Element,
      props: RollingDebtPayoffDashboardProps
    ) => void;
    unmountRollingDebtPayoffDashboard: () => void;
  }
}

let activeRoot: Root | null = null;

window.mapPlannerPayloadToRollingDebtPayoffDashboardData = mapPlannerPayloadToRollingDebtPayoffDashboardData;
window.demoRollingDebtPayoffDashboardData = demoRollingDebtPayoffDashboardData;

window.unmountRollingDebtPayoffDashboard = function unmountRollingDebtPayoffDashboard() {
  if (activeRoot) {
    activeRoot.unmount();
    activeRoot = null;
  }
};

window.mountRollingDebtPayoffDashboard = function mountRollingDebtPayoffDashboard(
  container: Element,
  props: RollingDebtPayoffDashboardProps
) {
  window.unmountRollingDebtPayoffDashboard();
  activeRoot = createRoot(container);
  activeRoot.render(<RollingDebtPayoffDashboard {...props} />);
};
