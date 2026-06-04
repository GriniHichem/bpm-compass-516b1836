
UPDATE public.licenses
   SET used = false, used_at = NULL, used_by_install = NULL
 WHERE code = '246Y5HJB8JBRQAD2UBBXJX6B25JYKD57';

UPDATE public.app_settings SET value = 'trial' WHERE key = 'license_mode';
UPDATE public.app_settings SET value = ''      WHERE key = 'license_key';
UPDATE public.app_settings SET value = ''      WHERE key = 'license_activated_at';
UPDATE public.app_settings SET value = ''      WHERE key = 'license_expires_at';
UPDATE public.app_settings SET value = 'false' WHERE key = 'license_unlimited';
