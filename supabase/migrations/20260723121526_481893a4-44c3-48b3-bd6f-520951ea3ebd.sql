
-- Promote current user to ADMIN and (re)create trigger to auto-assign first user as ADMIN
UPDATE public.user_roles SET role = 'ADMIN' WHERE user_id = '6d28d0e3-3489-42e2-9ea3-a2fc870f521b';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
