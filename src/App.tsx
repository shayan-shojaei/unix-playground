import { useEffect, useState } from 'react';
import { COURSES, type CourseId } from './curriculum/types';
import CourseLanding from './curriculum/CourseLanding';
import CourseSession from './curriculum/CourseSession';
import './styles/terminal.css';

const BASE = import.meta.env.BASE_URL;

// GitHub Pages serves no server-side rewrites, so a hard refresh on
// /unix-playground/text-tools would 404 — public/404.html redirects it here
// as /unix-playground/?redirect=text-tools%23t1-grep-2 instead. Restore the
// real path (and hash) before the app's first render reads location.
(function consumeRedirectParam() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
  if (redirect === null) return;
  window.history.replaceState(null, '', BASE + redirect);
})();

function courseIdFromPath(pathname: string): CourseId | null {
  const slug = (pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname).replace(/\/$/, '');
  return COURSES.some((c) => c.id === slug) ? (slug as CourseId) : null;
}

function pathForCourse(courseId: CourseId): string {
  return BASE + courseId;
}

export default function App() {
  const [courseId, setCourseId] = useState<CourseId | null>(() => courseIdFromPath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setCourseId(courseIdFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const selectCourse = (id: CourseId) => {
    window.history.pushState(null, '', pathForCourse(id));
    setCourseId(id);
  };

  const backToLanding = () => {
    window.history.pushState(null, '', BASE);
    setCourseId(null);
  };

  if (!courseId) return <CourseLanding onSelect={selectCourse} />;

  return <CourseSession key={courseId} courseId={courseId} onBack={backToLanding} />;
}
