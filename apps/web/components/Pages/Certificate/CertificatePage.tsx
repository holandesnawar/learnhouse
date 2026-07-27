'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { getUserCertificates } from '@services/courses/certifications';
import CertificatePreview from '@components/Dashboard/Pages/Course/EditCourseCertification/CertificatePreview';
import { downloadCertificatePdf, certificateFileName } from './downloadCertificatePdf';
import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { getUriWithOrg } from '@services/config/config';

interface CertificatePageProps {
  orgslug: string;
  courseid: string;
  qrCodeLink: string;
}

const CertificatePage: React.FC<CertificatePageProps> = ({ orgslug, courseid, qrCodeLink }) => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const [userCertificate, setUserCertificate] = useState<any>(null);
  // El certificado debe llevar el nombre de quien lo recibe.
  const studentName = [session?.data?.user?.first_name, session?.data?.user?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || session?.data?.user?.username || '';
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user certificate
  useEffect(() => {
    const fetchCertificate = async () => {
      if (!session?.data?.tokens?.access_token) {
        setError('Authentication required to view certificate');
        setIsLoading(false);
        return;
      }

      if (!org?.id) {
        return; // Wait for org to be available
      }

      try {
        const cleanCourseId = courseid.replace('course_', '');
        const result = await getUserCertificates(
          `course_${cleanCourseId}`,
          org.id,
          session.data.tokens.access_token
        );

        if (result.success && result.data && result.data.length > 0) {
          setUserCertificate(result.data[0]);
        } else {
          setError('No certificate found for this course');
        }
      } catch (error) {
        console.error('Error fetching certificate:', error);
        setError('Failed to load certificate. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCertificate();
  }, [courseid, session?.data?.tokens?.access_token, org?.id]);



  // El PDF captura el MISMO certificado que se ve arriba (antes se
  // reconstruía en HTML aparte y la descarga no se parecía a la vista).
  const certificateRef = React.useRef<HTMLDivElement>(null);

  const downloadCertificate = async () => {
    if (!userCertificate) return;
    try {
      await downloadCertificatePdf(
        certificateRef.current,
        certificateFileName(userCertificate.certification?.config?.certification_name)
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('No se pudo generar el PDF. Inténtalo de nuevo.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading certificate...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Certificate Not Available</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <Link
              href={getUriWithOrg(orgslug, '') + `/course/${courseid}`}
              className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-full hover:bg-blue-700 transition duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Course</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!userCertificate) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">No Certificate Found</h2>
            <p className="text-yellow-600 mb-4">
              No certificate is available for this course. Please contact your instructor for more information.
            </p>
            <Link
              href={getUriWithOrg(orgslug, '') + `/course/${courseid}`}
              className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-full hover:bg-blue-700 transition duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Course</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href={getUriWithOrg(orgslug, '') + `/course/${courseid}`}
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition duration-200"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Course</span>
          </Link>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={downloadCertificate}
              className="inline-flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-full hover:bg-green-700 transition duration-200"
            >
              <Download className="w-5 h-5" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {/* Certificate Display */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="max-w-2xl mx-auto">
            <CertificatePreview
              certificationName={userCertificate.certification.config.certification_name}
              certificationDescription={userCertificate.certification.config.certification_description}
              certificationType={userCertificate.certification.config.certification_type}
              certificatePattern={userCertificate.certification.config.certificate_pattern}
              certificateInstructor={userCertificate.certification.config.certificate_instructor}
              certificateId={userCertificate.certificate_user.user_certification_uuid}
              awardedDate={new Date(userCertificate.certificate_user.created_at).toLocaleDateString('nl-NL', {
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

        {/* Instructions */}
        <div className="mt-8 text-center text-gray-600">
          <p className="mb-2">
            Click "Download PDF" to generate and download a high-quality certificate PDF.
          </p>
          <p className="text-sm">
            The PDF includes a scannable QR code for certificate verification.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CertificatePage; 