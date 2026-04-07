-- Allow admin to update (deactivate) any product for moderation purposes
-- Uses auth.email() (security-definer) instead of SELECT from auth.users (no direct permission)
DROP POLICY IF EXISTS "Admin can moderate any product" ON public.products;
CREATE POLICY "Admin can moderate any product"
ON public.products
FOR UPDATE
TO authenticated
USING ((auth.jwt() ->> 'email') = 'evcarvalhodev@gmail.com')
WITH CHECK ((auth.jwt() ->> 'email') = 'evcarvalhodev@gmail.com');
