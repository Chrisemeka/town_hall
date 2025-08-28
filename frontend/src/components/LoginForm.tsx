// @ts-ignore
import { zodResolver } from "@hookform/resolvers/zod"
// @ts-ignore
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

// @ts-ignore
const formSchema = z.object({
  email: z.string().min(1, {
    message: "Email address is required.",
  }),
  password: z.string().min(1, {
    message: "Password is required.",
  }),
})

export function LoginForm() {
    const [showPassword, setShowPassword] = useState(false)
    
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm text-blue-100 font-montserrat font-semibold">E-mail Address</FormLabel>
              <FormControl>
                <Input placeholder="E.g johnsnow@gmail.com" {...field}  className="input"/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm text-blue-100 font-montserrat font-semibold">Password</FormLabel>
              <FormControl>
                <div className="relative">
                    <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password" {...field}  
                    className="input"
                    />
                    <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    onClick={() => setShowPassword(!showPassword)}
                    >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="auth-btn bg-blue-50 text-white hover:bg-blue-50 rounded-lg">Login</Button>
      </form>
    </Form>
  
  )
}