import { h } from 'preact';
import { Dashboard } from './pages/Dashboard';
import { ChildProgress } from './pages/ChildProgress';
import { HafalanProgress } from './pages/HafalanProgress';
import { IqroProgress } from './pages/IqroProgress';
import { AttendanceView } from './pages/AttendanceView';
import { PaymentView } from './pages/PaymentView';
import { RaporView } from './pages/RaporView';
import { Notifications } from './pages/Notifications';

const routes: Record<string, () => h.JSX.Element> = {
  '/': () => <Dashboard />,
  '/progress': () => <ChildProgress />,
  '/hafalan': () => <HafalanProgress />,
  '/iqro': () => <IqroProgress />,
  '/attendance': () => <AttendanceView />,
  '/payments': () => <PaymentView />,
  '/rapor': () => <RaporView />,
  '/notifications': () => <Notifications />,
};

export function Router({ activeHref }: { activeHref: string }) {
  const Component = routes[activeHref];
  return Component ? Component() : <Dashboard />;
}
