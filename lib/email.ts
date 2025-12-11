import { Resend } from 'resend'

// 初始化Resend客户端
const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * 发送验证码邮件
 */
export async function sendVerificationCode(email: string, code: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'RSS Reader <onboarding@resend.dev>',
      to: email,
      subject: 'RSS阅读器 - 登录验证码',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background-color: #f9fafb;
                border-radius: 8px;
                padding: 40px;
                text-align: center;
              }
              .logo {
                font-size: 24px;
                font-weight: bold;
                color: #4f46e5;
                margin-bottom: 20px;
              }
              .code {
                font-size: 36px;
                font-weight: bold;
                color: #4f46e5;
                letter-spacing: 8px;
                margin: 30px 0;
                padding: 20px;
                background-color: white;
                border-radius: 8px;
                border: 2px solid #e5e7eb;
              }
              .message {
                color: #6b7280;
                margin: 20px 0;
              }
              .warning {
                color: #ef4444;
                font-size: 14px;
                margin-top: 20px;
              }
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                color: #9ca3af;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">🔥 RSS 阅读器</div>
              <h2>登录验证码</h2>
              <p class="message">您正在登录RSS阅读器，请使用以下验证码完成登录：</p>
              <div class="code">${code}</div>
              <p class="message">验证码有效期为 <strong>5分钟</strong></p>
              <p class="warning">⚠️ 如果这不是您的操作，请忽略此邮件</p>
              <div class="footer">
                <p>此邮件由系统自动发送，请勿回复</p>
              </div>
            </div>
          </body>
        </html>
      `
    })

    if (error) {
      console.error('发送邮件失败:', error)
      return { success: false, error: error.message }
    }

    console.log('邮件发送成功:', data)
    return { success: true, data }
  } catch (error) {
    console.error('发送邮件异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '发送失败' 
    }
  }
}

/**
 * 生成6位数字验证码
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
