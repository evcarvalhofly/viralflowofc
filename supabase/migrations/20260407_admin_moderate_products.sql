-- Allow admin to update (deactivate) any product for moderation purposes
CREATE POLICY "Admin can moderate any product"
ON public.products
FOR UPDATE
TO authenticated
USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'evcarvalhodev@gmail.com'
)
WITH CHECK (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'evcarvalhodev@gmail.com'
);
