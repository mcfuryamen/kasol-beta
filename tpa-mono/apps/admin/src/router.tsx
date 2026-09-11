import { h } from 'preact';
import { Dashboard } from './pages/Dashboard';
import { Students } from './pages/Students';
import { Teachers } from './pages/Teachers';
import { Guardians } from './pages/Guardians';
import { Classes } from './pages/Classes';
import { Schedules } from './pages/Schedules';
import { Curriculum } from './pages/Curriculum';
import { Attendance } from './pages/Attendance';
import { Hafalan } from './pages/Hafalan';
import { Iqro } from './pages/Iqro';
import { Payments } from './pages/Payments';
import { CashFlow } from './pages/CashFlow';
import { Reports } from './pages/Reports';
import { Certificates } from './pages/Certificates';
import { Projects } from './pages/Projects';
import { Locations } from './pages/Locations';
import { Settings } from './pages/Settings';

interface RouterProps {
  activeHref: string;
}

const routes: Record<string, () => h.JSX.Element> = {
  '/': () => <Dashboard />,
  '/students': () => <Students />,
  '/teachers': () => <Teachers />,
  '/guardians': () => <Guardians />,
  '/classes': () => <Classes />,
  '/schedules': () => <Schedules />,
  '/curriculum': () => <Curriculum />,
  '/attendance': () => <Attendance />,
  '/hafalan': () => <Hafalan />,
  '/iqro': () => <Iqro />,
  '/payments': () => <Payments />,
  '/cash-flow': () => <CashFlow />,
  '/reports': () => <Reports />,
  '/certificates': () => <Certificates />,
  '/projects': () => <Projects />,
  '/locations': () => <Locations />,
  '/settings': () => <Settings />,
};

export function Router({ activeHref }: RouterProps) {
  const Component = routes[activeHref];
  return Component ? Component() : <Dashboard />;
}
