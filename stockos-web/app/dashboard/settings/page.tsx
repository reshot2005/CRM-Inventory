'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { PageHeader } from '@/components/ui/enterprise';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

// ── Zod schemas ─────────────────────────────────

const companySchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  company_gstin: z.string().max(15, 'GSTIN must be 15 characters or fewer'),
  company_address: z.string(),
  company_phone: z.string(),
  timezone: z.string(),
});

const personalSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
});

const gstSchema = z.object({
  company_gstin: z.string().max(15, 'GSTIN must be 15 characters or fewer'),
});

type CompanyFormValues = {
  company_name: string;
  company_gstin: string;
  company_address: string;
  company_phone: string;
  timezone: string;
};

type PersonalFormValues = {
  full_name: string;
};

type GSTFormValues = {
  company_gstin: string;
};

// ── Profile row ─────────────────────────────────

interface ProfileRow {
  id: string;
  full_name: string | null;
  company_name: string | null;
  company_gstin: string | null;
  company_address: string | null;
  company_phone: string | null;
  logo_url: string | null;
  timezone: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ── Component ───────────────────────────────────

export default function SettingsPage() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'company' | 'personal' | 'gst'>(
    'company',
  );

  // ── Fetch profile ──

  const { data: profile, isLoading } = useRealtimeQuery<ProfileRow | null>(
    ['profile', userId ?? ''],
    'profiles',
    async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return (data as unknown as ProfileRow) ?? null;
    },
    !!userId,
  );

  // ── Company form ──

  const companyForm = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      company_name: '',
      company_gstin: '',
      company_address: '',
      company_phone: '',
      timezone: 'Asia/Kolkata',
    },
  });

  // ── Personal form ──

  const personalForm = useForm<PersonalFormValues>({
    resolver: zodResolver(personalSchema),
    defaultValues: {
      full_name: '',
    },
  });

  // ── GST form ──

  const gstForm = useForm<GSTFormValues>({
    resolver: zodResolver(gstSchema),
    defaultValues: {
      company_gstin: '',
    },
  });

  // ── Populate forms when profile loads ──

  useEffect(() => {
    if (!profile) return;

    companyForm.reset({
      company_name: profile.company_name ?? '',
      company_gstin: profile.company_gstin ?? '',
      company_address: profile.company_address ?? '',
      company_phone: profile.company_phone ?? '',
      timezone: profile.timezone ?? 'Asia/Kolkata',
    });

    personalForm.reset({
      full_name: profile.full_name ?? '',
    });

    gstForm.reset({
      company_gstin: profile.company_gstin ?? '',
    });

    if (profile.logo_url) {
      setLogoPreview(profile.logo_url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // ── Upsert helper ──

  const upsertProfile = useCallback(
    async (fields: Record<string, string | null>) => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .upsert(
          { id: userId, ...fields },
          { onConflict: 'id' },
        );

      if (error) throw error;
    },
    [supabase, userId],
  );

  // ── Company save mutation ──

  const companySaveMutation = useMutation({
    mutationFn: async (values: CompanyFormValues) => {
      if (!userId) throw new Error('Not authenticated');
      await upsertProfile({
        company_name: values.company_name || null,
        company_gstin: values.company_gstin || null,
        company_address: values.company_address || null,
        company_phone: values.company_phone || null,
        timezone: values.timezone || 'Asia/Kolkata',
      });

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'profile',
        entityId: userId,
        newValues: {
          company_name: values.company_name || null,
          company_gstin: values.company_gstin || null,
          timezone: values.timezone || 'Asia/Kolkata',
        },
      });
    },
    onSuccess: () => {
      toast.success('Company profile saved');
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Personal save mutation ──

  const personalSaveMutation = useMutation({
    mutationFn: async (values: PersonalFormValues) => {
      if (!userId) throw new Error('Not authenticated');
      await upsertProfile({
        full_name: values.full_name || null,
      });

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'profile',
        entityId: userId,
        newValues: { full_name: values.full_name || null },
      });
    },
    onSuccess: () => {
      toast.success('Personal info saved');
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── GST save mutation ──

  const gstSaveMutation = useMutation({
    mutationFn: async (values: GSTFormValues) => {
      if (!userId) throw new Error('Not authenticated');
      await upsertProfile({
        company_gstin: values.company_gstin || null,
      });

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'profile',
        entityId: userId,
        newValues: { company_gstin: values.company_gstin || null },
      });
    },
    onSuccess: () => {
      toast.success('GST settings saved');
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Logo upload mutation ──

  const logoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!userId) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop() ?? 'png';
      const filePath = `${userId}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      await upsertProfile({ logo_url: publicUrl });

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'profile',
        entityId: userId,
        newValues: { logo_url: publicUrl },
      });

      return publicUrl;
    },
    onSuccess: (url: string) => {
      setLogoPreview(url);
      setUploadProgress(0);
      toast.success('Logo uploaded');
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: Error) => {
      setUploadProgress(0);
      toast.error(`Logo upload failed: ${err.message}`);
    },
  });

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2 MB');
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setLogoPreview(localPreview);
    setUploadProgress(50);
    logoUploadMutation.mutate(file);
  }

  // ── Auto-save on blur ──

  const handleCompanyBlur = useCallback(() => {
    if (companyForm.formState.isDirty && companyForm.formState.isValid) {
      void companyForm.handleSubmit((vals) =>
        companySaveMutation.mutate(vals),
      )();
    }
  }, [companyForm, companySaveMutation]);

  const handlePersonalBlur = useCallback(() => {
    if (personalForm.formState.isDirty && personalForm.formState.isValid) {
      void personalForm.handleSubmit((vals) =>
        personalSaveMutation.mutate(vals),
      )();
    }
  }, [personalForm, personalSaveMutation]);

  const handleGSTBlur = useCallback(() => {
    if (gstForm.formState.isDirty && gstForm.formState.isValid) {
      void gstForm.handleSubmit((vals) =>
        gstSaveMutation.mutate(vals),
      )();
    }
  }, [gstForm, gstSaveMutation]);

  // ── Tab config ──

  const TABS = [
    { key: 'company' as const, label: 'Company Profile' },
    { key: 'personal' as const, label: 'Personal Info' },
    { key: 'gst' as const, label: 'GST Settings' },
  ];

  // ── Render ────────────────────────────────────

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="h-8 w-40 animate-pulse rounded bg-[#F1F5F9]" />
        <div className="space-y-4 rounded-lg border border-[#E2E8F0] bg-white p-6">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-[#F1F5F9]" />
              <div className="h-10 animate-pulse rounded bg-[#F1F5F9]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Manage company identity, personal details, and GST configuration." />

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-[#0F172A] shadow-sm'
                : 'text-[#64748B] hover:text-[#334155]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Company Profile Tab */}
      {activeTab === 'company' && (
        <div className="space-y-6">
          {/* Logo Section */}
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-[#0F172A]">
              Company Logo
            </h2>
            <div className="flex items-center gap-6">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC]">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt="Company logo"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#94A3B8]">
                    <svg
                      className="h-8 w-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploadMutation.isPending}
                  className="rounded-md bg-[#1E90FF] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#187bcd] disabled:opacity-50"
                >
                  {logoUploadMutation.isPending
                    ? 'Uploading…'
                    : logoPreview
                      ? 'Change Logo'
                      : 'Upload Logo'}
                </button>
                <p className="mt-1.5 text-xs text-[#94A3B8]">
                  PNG, JPG or WebP. Max 2 MB.
                </p>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleLogoSelect}
                />
              </div>
            </div>
          </div>

          {/* Company Form */}
          <form
            onSubmit={companyForm.handleSubmit((vals) =>
              companySaveMutation.mutate(vals),
            )}
            className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 text-base font-semibold text-[#0F172A]">
              Company Details
            </h2>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="company_name"
                  className="mb-1 block text-sm font-medium text-[#334155]"
                >
                  Company Name *
                </label>
                <input
                  id="company_name"
                  {...companyForm.register('company_name')}
                  onBlur={handleCompanyBlur}
                  className="w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#1E90FF]"
                />
                {companyForm.formState.errors.company_name && (
                  <p className="mt-1 text-xs text-red-600">
                    {companyForm.formState.errors.company_name.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="company_gstin_company"
                  className="mb-1 block text-sm font-medium text-[#334155]"
                >
                  GSTIN
                </label>
                <input
                  id="company_gstin_company"
                  {...companyForm.register('company_gstin')}
                  onBlur={handleCompanyBlur}
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  maxLength={15}
                  className="w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#1E90FF] font-mono"
                />
                {companyForm.formState.errors.company_gstin && (
                  <p className="mt-1 text-xs text-red-600">
                    {companyForm.formState.errors.company_gstin.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="company_address"
                  className="mb-1 block text-sm font-medium text-[#334155]"
                >
                  Company Address
                </label>
                <textarea
                  id="company_address"
                  rows={3}
                  {...companyForm.register('company_address')}
                  onBlur={handleCompanyBlur}
                  className="w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#1E90FF]"
                />
              </div>

              <div>
                <label
                  htmlFor="company_phone"
                  className="mb-1 block text-sm font-medium text-[#334155]"
                >
                  Phone
                </label>
                <input
                  id="company_phone"
                  type="tel"
                  {...companyForm.register('company_phone')}
                  onBlur={handleCompanyBlur}
                  className="w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#1E90FF]"
                />
              </div>

              <div>
                <label
                  htmlFor="timezone"
                  className="mb-1 block text-sm font-medium text-[#334155]"
                >
                  Timezone
                </label>
                <select
                  id="timezone"
                  {...companyForm.register('timezone')}
                  onBlur={handleCompanyBlur}
                  className="w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#1E90FF]"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={companySaveMutation.isPending}
                className="rounded-md bg-[#1E90FF] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#187bcd] disabled:opacity-50"
              >
                {companySaveMutation.isPending ? 'Saving…' : 'Save Company Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Personal Info Tab */}
      {activeTab === 'personal' && (
        <form
          onSubmit={personalForm.handleSubmit((vals) =>
            personalSaveMutation.mutate(vals),
          )}
          className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-base font-semibold text-[#0F172A]">
            Personal Information
          </h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="full_name"
                className="mb-1 block text-sm font-medium text-[#334155]"
              >
                Full Name *
              </label>
              <input
                id="full_name"
                {...personalForm.register('full_name')}
                onBlur={handlePersonalBlur}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#1E90FF]"
              />
              {personalForm.formState.errors.full_name && (
                <p className="mt-1 text-xs text-red-600">
                  {personalForm.formState.errors.full_name.message}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={personalSaveMutation.isPending}
              className="rounded-md bg-[#1E90FF] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#187bcd] disabled:opacity-50"
            >
              {personalSaveMutation.isPending ? 'Saving…' : 'Save Personal Info'}
            </button>
          </div>
        </form>
      )}

      {/* GST Settings Tab */}
      {activeTab === 'gst' && (
        <form
          onSubmit={gstForm.handleSubmit((vals) =>
            gstSaveMutation.mutate(vals),
          )}
          className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-base font-semibold text-[#0F172A]">
            GST Settings
          </h2>
          <p className="mb-4 text-sm text-[#64748B]">
            Your GSTIN is used on invoices and delivery challans generated by
            StockOS. Make sure it matches your GST registration certificate.
          </p>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="gst_gstin"
                className="mb-1 block text-sm font-medium text-[#334155]"
              >
                GSTIN
              </label>
              <input
                id="gst_gstin"
                {...gstForm.register('company_gstin')}
                onBlur={handleGSTBlur}
                placeholder="e.g. 22AAAAA0000A1Z5"
                maxLength={15}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#1E90FF] font-mono tracking-wider"
              />
              {gstForm.formState.errors.company_gstin && (
                <p className="mt-1 text-xs text-red-600">
                  {gstForm.formState.errors.company_gstin.message}
                </p>
              )}
            </div>

            <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <h3 className="mb-2 text-sm font-medium text-[#0F172A]">
                Current GSTIN
              </h3>
              <p className="font-mono text-lg tracking-wider text-[#334155]">
                {profile?.company_gstin || (
                  <span className="text-sm text-[#94A3B8]">Not set</span>
                )}
              </p>
            </div>

            <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Changes to your GSTIN will apply to all
                future invoices. Existing invoices will not be affected.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={gstSaveMutation.isPending}
              className="rounded-md bg-[#1E90FF] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#187bcd] disabled:opacity-50"
            >
              {gstSaveMutation.isPending ? 'Saving…' : 'Save GST Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
