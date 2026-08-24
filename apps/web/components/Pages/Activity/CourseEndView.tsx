import React, { useMemo, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
const ReactConfetti = dynamic(() => import('react-confetti'), { ssr: false });
import { Trophy, ArrowLeft, BookOpen, Target, Download, Shield } from 'lucide-react';
import Link from 'next/link';
import { getUriWithOrg } from '@services/config/config';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { useWindowSize } from 'usehooks-ts';
import { useSearchParams } from 'next/navigation';
import { useOrg } from '@components/Contexts/OrgContext';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { getUserCertificates } from '@services/courses/certifications';
import CertificatePreview from '@components/Dashboard/Pages/Course/EditCourseCertification/CertificatePreview';
import { downloadCertificatePdf, certificateFileName } from '@components/Pages/Certificate/downloadCertificatePdf';
import { useTranslation } from 'react-i18next';

/** El canal «Victorias» de la comunidad.
 *
 * Va escrito aquí y no en la configuración de la organización porque es un
 * único canal en una única escuela, y una pantalla de ajustes para esto sería
 * más trabajo que el propio botón. Si algún día se borra ese canal, el botón
 * llevará a una página que no existe: cambiar el identificador de abajo por el
 * del canal nuevo (sale de la barra del navegador al abrirlo). */
const CANAL_VICTORIAS = 'bbe57cb8-5197-4195-bc1f-6615aed4dcab';

interface CourseEndViewProps {
  courseName: string;
  orgslug: string;
  courseUuid: string;
  thumbnailImage: string;
  course: any;
  trailData: any;
}

const CourseEndView: React.FC<CourseEndViewProps> = ({ 
  courseName, 
  orgslug, 
  courseUuid, 
  thumbnailImage, 
  course, 
  trailData 
}) => {
  const { t, i18n } = useTranslation();
  const { width, height } = useWindowSize();
  const org = useOrg() as any;
  const session = useLHSession() as any;
  // El certificado lleva el nombre de quien lo recibe.
  const studentName = [session?.data?.user?.first_name, session?.data?.user?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || session?.data?.user?.username || '';
  const [userCertificate, setUserCertificate] = useState<any>(null);
  const [isLoadingCertificate, setIsLoadingCertificate] = useState(false);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const qrCodeLink = getUriWithOrg(orgslug, `/certificates/${userCertificate?.certificate_user.user_certification_uuid}/verify`);



  // Previsualización para el equipo: `?preview=fin` en la dirección de la
  // pantalla de fin enseña la versión de "curso terminado" sin haberlo
  // terminado, para poder revisar el texto y el diseño sin completar 149
  // actividades. Solo la ven los superadmins; a un alumno el parámetro no le
  // hace nada.
  const searchParams = useSearchParams();
  const esEquipo = Boolean(session?.data?.user?.is_superadmin);
  const previsualizandoFin = esEquipo && searchParams?.get('preview') === 'fin';

  // Check if course is actually completed
  const cursoTerminadoDeVerdad = useMemo(() => {
    if (!trailData || !course) return false;
    
    // Flatten all activities
    const allActivities = course.chapters.flatMap((chapter: any) => 
      chapter.activities.map((activity: any) => ({
        ...activity,
        chapterId: chapter.id
      }))
    );
    
    // Check if all activities are completed
    const isActivityDone = (activity: any) => {
      const cleanCourseUuid = course.course_uuid?.replace('course_', '');
      const run = trailData?.runs?.find(
        (run: any) => {
          const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
          return cleanRunCourseUuid === cleanCourseUuid;
        }
      );
      
      if (run) {
        return run.steps.find(
          (step: any) => step.activity_id === activity.id && step.complete === true
        );
      }
      return false;
    };
    
    const totalActivities = allActivities.length;
    const completedActivities = allActivities.filter((activity: any) => isActivityDone(activity)).length;
    return totalActivities > 0 && completedActivities === totalActivities;
  }, [trailData, course]);

  const isCourseCompleted = cursoTerminadoDeVerdad || previsualizandoFin;

  // En previsualización se inventa un certificado de muestra: sin él la
  // pantalla enseñaba "Sin certificado" y no se podía revisar justo lo que
  // más importa de ese momento. Solo ocurre para el equipo y nunca se guarda
  // en ninguna parte: es un objeto en memoria que muere al recargar.
  const certificadoDeMuestra = useMemo(
    () => ({
      certificate_user: {
        user_certification_uuid: 'certificado-de-muestra',
        created_at: new Date().toISOString(),
      },
      certification: {
        config: {
          certification_name: courseName,
          certification_description: '',
          certification_type: 'completion',
          certificate_pattern: '',
          certificate_instructor: '',
        },
      },
    }),
    [courseName]
  );
  const certificadoAEnsenar =
    userCertificate ?? (previsualizandoFin ? certificadoDeMuestra : null);

  // Fetch user certificate when course is completed
  useEffect(() => {
    const fetchUserCertificate = async () => {
      // Se busca el certificado solo si el curso está terminado DE VERDAD. En
      // previsualización no hay ninguno que buscar, y si se buscara la pantalla
      // acabaría enseñando el aviso de "Sin certificado" — que además se pinta
      // antes que el certificado, así que tapaba justo lo que se quería revisar.
      if (!cursoTerminadoDeVerdad) return;

      if (!session?.data?.tokens?.access_token) {
        setCertificateError(t('auth.authenticate_to_contribute')); // Reusing an auth error key
        return;
      }

      if (!org?.id) {
        return; // Wait for org to be available
      }

      setIsLoadingCertificate(true);
      setCertificateError(null);
      try {
        const cleanCourseUuid = courseUuid.replace('course_', '');
        const result = await getUserCertificates(
          `course_${cleanCourseUuid}`,
          org.id,
          session.data.tokens.access_token
        );

        if (result.success && result.data && result.data.length > 0) {
          setUserCertificate(result.data[0]);
        } else {
          setCertificateError(t('certificate.no_certificate'));
        }
      } catch (error) {
        console.error('Error fetching user certificate:', error);
        setCertificateError(t('certificate.failed_load_certificates'));
      } finally {
        setIsLoadingCertificate(false);
      }
    };

    fetchUserCertificate();
  }, [cursoTerminadoDeVerdad, courseUuid, session?.data?.tokens?.access_token, org?.id]);

  // El PDF captura el MISMO certificado que se ve en pantalla (antes esta
  // pantalla reconstruía el diseño en HTML por su cuenta).
  const certificateRef = React.useRef<HTMLDivElement>(null);

  const downloadCertificate = async () => {
    if (!userCertificate) return;
    try {
      await downloadCertificatePdf(
        certificateRef.current,
        certificateFileName(certificadoAEnsenar?.certification?.config?.certification_name)
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('No se pudo generar el PDF. Inténtalo de nuevo.');
    }
  };

  // Calculate progress for incomplete courses
  const progressInfo = useMemo(() => {
    if (!trailData || !course || isCourseCompleted) return null;
    
    const allActivities = course.chapters.flatMap((chapter: any) => 
      chapter.activities.map((activity: any) => ({
        ...activity,
        chapterId: chapter.id
      }))
    );
    
    const isActivityDone = (activity: any) => {
      const cleanCourseUuid = course.course_uuid?.replace('course_', '');
      const run = trailData?.runs?.find(
        (run: any) => {
          const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
          return cleanRunCourseUuid === cleanCourseUuid;
        }
      );
      
      if (run) {
        return run.steps.find(
          (step: any) => step.activity_id === activity.id && step.complete === true
        );
      }
      return false;
    };
    
    const totalActivities = allActivities.length;
    const completedActivities = allActivities.filter((activity: any) => isActivityDone(activity)).length;
    const progressPercentage = Math.round((completedActivities / totalActivities) * 100);
    
    return {
      completed: completedActivities,
      total: totalActivities,
      percentage: progressPercentage
    };
  }, [trailData, course, isCourseCompleted]);

  if (isCourseCompleted) {
    // Show congratulations for completed course
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none">
          <ReactConfetti
            width={width}
            height={height}
            numberOfPieces={200}
            recycle={false}
            colors={['#6366f1', '#10b981', '#3b82f6']}
          />
        </div>
        
        <div className="bg-white rounded-2xl p-8 nice-shadow max-w-4xl w-full space-y-6 relative z-10">
          <div className="flex flex-col items-center space-y-6">
            {thumbnailImage && (
              <img
                className="w-[200px] h-[114px] rounded-lg shadow-md object-cover"
                src={`${getCourseThumbnailMediaDirectory(
                  org?.org_uuid,
                  courseUuid,
                  thumbnailImage
                )}`}
                alt={courseName}
              />
            )}
            
            <div className="bg-emerald-100 p-4 rounded-full">
              <Trophy className="w-16 h-16 text-emerald-600" />
            </div>
          </div>
          
          <h1 className="text-4xl font-bold text-gray-900">
            {t('courses.congratulations')}
          </h1>
          
          <p className="text-xl text-gray-600">
            {t('courses.successfully_completed')}
            <span className="font-semibold text-gray-900"> {courseName}</span>
          </p>
          
          <p className="text-gray-500">
            {t('certificate.dedication_message')}
          </p>

          {isLoadingCertificate ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4da3ff]"></div>
              <span className="ml-3 text-gray-600">{t('certificate.loading_certificate')}</span>
            </div>
          ) : certificateError ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <p className="text-yellow-800">
                {certificateError}
              </p>
            </div>
          ) : certificadoAEnsenar ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">{t('certificate.your_certificate')}</h2>
              <div className="max-w-2xl mx-auto" id="certificate-preview">
                <div id="certificate-content">
                  <CertificatePreview
                    certificationName={certificadoAEnsenar.certification.config.certification_name}
                    certificationDescription={certificadoAEnsenar.certification.config.certification_description}
                    certificationType={certificadoAEnsenar.certification.config.certification_type}
                    certificatePattern={certificadoAEnsenar.certification.config.certificate_pattern}
                    certificateInstructor={certificadoAEnsenar.certification.config.certificate_instructor}
                    certificateId={certificadoAEnsenar.certificate_user.user_certification_uuid}
                    awardedDate={new Date(certificadoAEnsenar.certificate_user.created_at).toLocaleDateString('nl-NL', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                    qrCodeLink={qrCodeLink}
                    studentName={studentName}
                    innerRef={certificateRef}
                  />
                </div>
              </div>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={downloadCertificate}
                  className="inline-flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-full hover:bg-green-700 transition duration-200"
                >
                  <Download className="w-5 h-5" />
                  <span>{t('certificate.download_certificate')}</span>
                </button>
                <Link
                  href={getUriWithOrg(orgslug, `/certificates/${certificadoAEnsenar.certificate_user.user_certification_uuid}/verify`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 bg-[#4da3ff] text-[#1D0084] px-6 py-3 rounded-full hover:bg-[#5eb4ff] transition duration-200"
                >
                  <Shield className="w-5 h-5" />
                  <span>{t('certificate.verify_certificate')}</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-gray-600">
                {t('certificate.no_certificate_available')}
              </p>
            </div>
          )}

          {/* Contarlo en la comunidad.
              Se pide algo concreto y no un "he terminado": si los 40 alumnos
              acaban la misma semana, cuarenta mensajes idénticos son ruido,
              mientras que cuarenta respuestas a esta pregunta son cuarenta
              historias distintas — y el material con el que se vende la
              siguiente convocatoria, escrito por ellos y el día que están más
              orgullosos. */}
          <div className="pt-8 max-w-xl mx-auto">
            <div className="bg-[#F0F5FF] rounded-2xl px-5 py-6">
              <p className="text-[15px] text-[#0a1656] leading-relaxed">
                ¿Qué eres capaz de hacer hoy en neerlandés que no podías
                al empezar?
              </p>
              <p className="text-[13.5px] text-[#0a1656]/70 mt-2 leading-relaxed">
                Cuéntaselo a tus compañeros: a quien viene detrás le vas a dar
                justo el empujón que tú necesitabas.
              </p>
              <Link
                href={getUriWithOrg(orgslug, `/community/${CANAL_VICTORIAS}`)}
                className="mt-4 inline-flex items-center gap-2 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold px-5 py-3 rounded-xl transition-colors text-[14.5px]"
              >
                <Trophy className="w-4 h-4" />
                <span>Compartir mi victoria</span>
              </Link>
            </div>
          </div>

          <div className="pt-6">
            <Link
              href={getUriWithOrg(orgslug, `/course/${courseUuid.replace('course_', '')}`)}
              className="inline-flex items-center space-x-2 bg-gray-800 text-white px-6 py-3 rounded-full hover:bg-gray-700 transition duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t('courses.back_to_course')}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  } else {
    // Show progress and encouragement for incomplete course
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
        <div className="bg-white rounded-2xl p-8 nice-shadow max-w-2xl w-full space-y-6">
          <div className="flex flex-col items-center space-y-6">
            {thumbnailImage && (
              <img
                className="w-[200px] h-[114px] rounded-lg shadow-md object-cover"
                src={`${getCourseThumbnailMediaDirectory(
                  org?.org_uuid,
                  courseUuid,
                  thumbnailImage
                )}`}
                alt={courseName}
              />
            )}
            
            <div className="bg-[#F0F5FF] p-4 rounded-full">
              <Target className="w-16 h-16 text-[#025dc7]" />
            </div>
          </div>
          
          <h1 className="text-4xl font-bold text-gray-900">
            {t('courses.keep_going')}
          </h1>
          
          <p className="text-xl text-gray-600">
            {t('courses.making_great_progress')}
            <span className="font-semibold text-gray-900"> {courseName}</span>
          </p>
          
          {progressInfo && (
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-center space-x-2">
                <BookOpen className="w-5 h-5 text-gray-600" />
                <span className="text-lg font-semibold text-gray-700">{t('courses.course_progress')}</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('courses.progress')}</span>
                  <span className="font-semibold text-gray-900">{progressInfo.percentage}%</span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-[#4da3ff] h-3 rounded-full transition-all duration-500"
                    style={{ width: `${progressInfo.percentage}%` }}
                  ></div>
                </div>
                
                <div className="text-sm text-gray-500">
                  {t('courses.completed_of', { completed: progressInfo.completed, total: progressInfo.total })}
                </div>
              </div>
            </div>
          )}
          
          <p className="text-gray-500">
            {t('courses.keep_going_description')}
          </p>

          <div className="pt-6">
            <Link
              href={getUriWithOrg(orgslug, `/course/${courseUuid.replace('course_', '')}`)}
              className="inline-flex items-center space-x-2 bg-[#4da3ff] text-[#1D0084] px-6 py-3 rounded-full hover:bg-[#5eb4ff] transition duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t('courses.continue_learning')}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }
};

export default CourseEndView; 