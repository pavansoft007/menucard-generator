import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { loginSchema, type LoginInput } from '@gc/shared-types';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';

export default function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const { register, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const login = useMutation({
    mutationFn: authService.login,
    onSuccess: (r) => {
      setSession(r.token, r.user);
      navigate(from, { replace: true });
    },
  });

  if (token) return <Navigate to="/" replace />;

  return (
    <Box className="flex min-h-full items-center justify-center p-4" sx={{ bgcolor: '#080808' }}>
      <Card sx={{ width: 400, maxWidth: '100%', border: '1px solid #D99A19' }}>
        <CardContent className="flex flex-col gap-4 p-8">
          <Box className="text-center">
            <Typography variant="h5" fontWeight={800} sx={{ color: '#F5B51B', letterSpacing: 2 }}>
              GOLDEN CRUNCH
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Menu Builder – sign in
            </Typography>
          </Box>
          {login.error && <Alert severity="error">{login.error.message}</Alert>}
          <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => login.mutate(v))} noValidate>
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              {...register('email')}
              error={!!formState.errors.email}
              helperText={formState.errors.email?.message}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              error={!!formState.errors.password}
              helperText={formState.errors.password?.message}
            />
            <Button type="submit" variant="contained" size="large" disabled={login.isPending}>
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
