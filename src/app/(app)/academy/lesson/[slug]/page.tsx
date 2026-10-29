import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLesson, LESSONS } from "@/content/curriculum";
import { LessonView } from "@/features/lesson/lesson-view";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: getLesson(slug)?.title ?? "Lesson" };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) notFound();
  return <LessonView slug={lesson.slug} />;
}
