import { createTransport } from 'nodemailer';

interface emailData {
  email: string;
  otp: string;
  userName?: string;
}

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string; 
  };
}

const createEmailTransporter = () => {
  const config: EmailConfig = {
    host: process.env.EMAIL_HOST!,
    port: parseInt(process.env.EMAIL_PORT!),
    secure: false, 
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASS! ,
    },
  };
  return createTransport(config);
};

const generateEmailTemplate = (options: emailData): string => {
    const { userName, otp } = options;

    return `
       <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background-color: #f9f9f9;
          padding: 30px;
          border-radius: 10px;
          border: 1px solid #ddd;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .button {
          display: inline-block;
          background-color: #007bff;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          margin: 20px 0;
        }
        .button:hover {
          background-color: #0056b3;
        }
        .footer {
          margin-top: 30px;
          font-size: 12px;
          color: #666;
          text-align: center;
        }
        .warning {
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Email Verification</h1>
        </div>
        
        <p>Hello ${userName},</p>
        
        <p>Please the below is the OTP to verify your email address and complete your authentication:</p>
        
        <div style="text-align: center;">
          <h2>${otp}</h2>
        </div>
        
        <div class="warning">
          <strong>Important:</strong> Please do not share the OTP with anyone. If you didn't request this email, please ignore it.
        </div>
        
        <div class="footer">
          <p>If you didn't request this verification, please ignore this email.</p>
          <p>This is an automated message, please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;     
}

export default async function sendOtpEmail(options: emailData) {
    try {
         if (!options.email || !options.otp) {
            throw new Error('Email and OTP are required');
        } 
        const transporter = createEmailTransporter();
        await transporter.verify
        const htmlContent = generateEmailTemplate(options);

        const mailOptions = {
            from: `Town Hall <townhall@gmail.com>`,
            to: options.email,
            subject: 'Verify Your Email - OTP',
            html: htmlContent,
            text: `
                Hello ${options.userName || 'there'},
                
                Please verify your email with the OTP: ${options.otp}
                                
                If you didn't request this email, please ignore it.
            `,
        };
        const info = await transporter.sendMail(mailOptions);
         return {
            success: true,
            message: 'OTP sent successfully',
         }
    } catch (error) {
        return {
            success: false,
            message: 'Failed to send OTP to email',
            error: error
        }
    }
}