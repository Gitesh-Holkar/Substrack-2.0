import { createClient } from '@/lib/supabase/client';

export async function signUp(email: string, password: string, fullName: string, businessName: string) {
  const supabase = createClient();
  
  // Step 1: Create the auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Failed to create user');

  // Step 2: Call the database function to create merchant profile
  const { error: merchantError } = await supabase.rpc('create_merchant_profile', {
    user_id: authData.user.id,
    user_email: email,
    user_full_name: fullName,
    user_business_name: businessName,
  });

  if (merchantError) {
    console.error('Error creating merchant profile:', merchantError);
    throw merchantError;
  }

  return authData;
}

export async function signIn(email: string, password: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const supabase = createClient();
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function handleOAuthCallback(fullName?: string, businessName?: string) {
  const supabase = createClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error('No user found after OAuth');
  }

  // Check if merchant profile already exists
  const { data: existingMerchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  // If merchant doesn't exist, create profile
  if (!existingMerchant) {
    const { error: merchantError } = await supabase.rpc('create_merchant_profile', {
      user_id: user.id,
      user_email: user.email || '',
      user_full_name: fullName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      user_business_name: businessName || user.user_metadata?.full_name || 'My Business',
    });

    if (merchantError) {
      console.error('Error creating merchant profile:', merchantError);
      throw merchantError;
    }
  }

  return user;
}

export async function signOut() {
  const supabase = createClient();
  
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const supabase = createClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function getMerchantProfile(userId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}