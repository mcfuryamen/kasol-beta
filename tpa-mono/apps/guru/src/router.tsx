import { h } from 'preact';
import { Dashboard } from './pages/Dashboard';
import { MyClasses } from './pages/MyClasses';
import { AttendanceInput } from './pages/AttendanceInput';
import { HafalanInput } from './pages/HafalanInput';
import { IqroInput } from './pages/IqroInput';
import { StudentProgress } from './pages/StudentProgress';
import { CurriculumView } from './pages/CurriculumView';
import { Schedule } from './pages/Schedule';
import { Notes } from './pages/Notes';
import { Projects } from './pages/Projects';

const routes: Record<string, () => h.JSX.Element> = {
  '/': () => <Dashboard />,
  '/my-classes': () => <MyClasses />,
  '/attendance': () => <AttendanceInput />,
  '/hafalan': () => <HafalanInput />,
  '/iqro': () => <IqroInput />,
  '/progress': () => <StudentProgress />,
  '/curriculum': () => <CurriculumView />,
  '/schedule': () => <Schedule />,
  '/notes': () => <Notes />,
  '/projects': () => <Projects />,
};

export function Router({ activeHref }: { activeHref: string }) {
  const Component = routes[activeHref];
  return Component ? Component() : <Dashboard />;
}
