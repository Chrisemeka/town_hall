
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set({ name, value, ...options })
            )
          } catch (error) {
          }
        },
      },
    }
  )
}


export const uploadToStorage = async (supabase: Awaited<ReturnType<typeof createClient>>, file: File, userId: string) => {
  const fileName = `${userId}/${Date.now()}-${file.name}`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("screenshots")
    .upload(fileName, file)

  if (uploadError) {
    console.error("Supabase Storage Error:", uploadError)
    throw new Error(uploadError.message)
  }

  return uploadData
}

export const getPublicUrl = (supabase: Awaited<ReturnType<typeof createClient>>, filePath: string) => {
  const { data: { publicUrl } } = supabase.storage
    .from("screenshots")
    .getPublicUrl(filePath)
  
  return publicUrl
}