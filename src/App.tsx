import { useState } from 'react';
import type { CourseId } from './curriculum/types';
import CourseLanding from './curriculum/CourseLanding';
import CourseSession from './curriculum/CourseSession';
import './styles/terminal.css';

export default function App() {
  const [selectedCourseId, setSelectedCourseId] = useState<CourseId | null>(null);

  if (!selectedCourseId) return <CourseLanding onSelect={setSelectedCourseId} />;

  return <CourseSession key={selectedCourseId} courseId={selectedCourseId} onBack={() => setSelectedCourseId(null)} />;
}
