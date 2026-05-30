'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { getCourseMetadata } from '@services/courses/courses'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUserCertificates } from '@services/courses/certifications'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { Award, ExternalLink, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface TrailCourseCardProps {
  course: any
  run: any
  orgslug: string
}

function TrailCourseCard(props: TrailCourseCardProps) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const courseid = props.course.course_uuid.replace('course_', '')
  const course = props.course
  const course_total_steps = props.run.course_total_steps
  const course_completed_steps = props.run.steps.length
  const orgID = org?.id
  const course_progress = course_total_steps > 0
    ? Math.round((course_completed_steps / course_total_steps) * 100)
    : 0

  const [courseCertificate, setCourseCertificate] = useState<any>(null)
  const [isLoadingCertificate, setIsLoadingCertificate] = useState(false)
  const queryClient = useQueryClient()

  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.courses.meta(courseid),
      queryFn: () => getCourseMetadata(courseid, {}, access_token, { slim: true }),
      staleTime: 60_000,
    })
  }


  useEffect(() => {
    const fetchCourseCertificate = async () => {
      if (!access_token || course_progress < 100 || !org?.id) return;

      setIsLoadingCertificate(true);
      try {
        const result = await getUserCertificates(
          props.course.course_uuid,
          org.id,
          access_token
        );

        if (result.success && result.data && result.data.length > 0) {
          setCourseCertificate(result.data[0]);
        }
      } catch (error) {
        console.error('Error fetching course certificate:', error);
      } finally {
        setIsLoadingCertificate(false);
      }
    };

    fetchCourseCertificate();
  }, [access_token, course_progress, props.course.course_uuid, org?.id]);

  useEffect(() => { }, [props.course, org])

  const courseLink = getUriWithOrg(props.orgslug, '/course/' + courseid)

  return (
    <div className="group relative flex flex-col bg-white rounded-2xl nice-shadow overflow-hidden w-full transition-all duration-300 hover:scale-[1.01]" onMouseEnter={handleMouseEnter}>
      {/* Thumbnail */}
      <Link
        href={courseLink}
        className="block relative aspect-video overflow-hidden bg-gray-50"
      >
        {props.course.thumbnail_image && org?.org_uuid ? (
          <img
            src={getCourseThumbnailMediaDirectory(
              org.org_uuid,
              props.course.course_uuid,
              props.course.thumbnail_image
            )}
            alt={course.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full w-full text-gray-300 gap-2">
            <BookOpen size={40} strokeWidth={1.5} />
          </div>
        )}
        {/* Progress overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-200/80">
          <div
            className={`h-full ${course_progress === 100 ? 'bg-green-500' : 'bg-teal-500'}`}
            style={{ width: `${course_progress}%` }}
          />
        </div>
      </Link>

      {/* Content */}
      <div className="p-3 flex flex-col space-y-1.5">
        <Link
          href={courseLink}
          className="text-base font-bold text-gray-900 leading-tight hover:text-black transition-colors line-clamp-1"
        >
          {course.name}
        </Link>

        <div className="flex items-center gap-2 text-sm">
          <span className={`font-semibold ${course_progress === 100 ? 'text-green-600' : 'text-teal-600'}`}>
            {course_progress}%
          </span>
          <span className="text-gray-400 text-xs">
            {t('courses.completed_of', { completed: course_completed_steps, total: course_total_steps })}
          </span>
        </div>

        <div className="pt-1.5 flex items-center justify-between border-t border-gray-100">
          {/* Certificate or Progress indicator */}
          {course_progress === 100 ? (
            isLoadingCertificate ? (
              <div className="flex items-center gap-1.5 text-gray-400">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-500"></div>
                <span className="text-[10px] font-bold uppercase tracking-wider">{t('common.loading')}</span>
              </div>
            ) : courseCertificate ? (
              <div className="flex items-center gap-1.5 text-yellow-600">
                <Award size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{t('certificate.certificate')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-green-600">
                <Award size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{t('common.completed')}</span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-1.5 text-gray-500">
              <BookOpen size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{t('courses.course_progress')}</span>
            </div>
          )}

          {course_progress === 100 && courseCertificate ? (
            <Link
              href={getUriWithOrg(props.orgslug, `/certificates/${courseCertificate.certificate_user.user_certification_uuid}/verify`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-[#025dc7] hover:text-[#1D0084] uppercase tracking-wider"
            >
              {t('certificate.verify')}
              <ExternalLink className="w-3 h-3" />
            </Link>
          ) : (
            <Link
              href={courseLink}
              className="text-[10px] font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-wider"
            >
              {t('courses.continue_learning')}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default TrailCourseCard
