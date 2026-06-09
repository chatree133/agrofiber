import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import { mssqlQuery, sql } from '../../lib/mssql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templateDir = path.resolve(__dirname, '../../public/templates');

async function loadTemplate(templateName) {
  const templatePath = path.join(templateDir, templateName);
  return fs.readFile(templatePath, 'utf8');
}

async function getActiveSmtpSettings() {
  const rows = await mssqlQuery('DEFAULT', `
    SELECT TOP 1 *
    FROM dbo.SmtpSettings
    WHERE IsActive = 1
    ORDER BY SmtpSettingId DESC
  `);

  if (!rows.length) {
    throw new Error('No active SMTP configuration found');
  }

  return rows[0];
}

function buildTransporter(config) {
  return nodemailer.createTransport({
    host: config.SmtpHost,
    port: config.SmtpPort,
    secure: Number(config.SmtpPort) === 465,
    auth: {
      user: config.SmtpUser,
      pass: config.SmtpPassword,
    },
  });
}

async function sendEmail({ to, subject, html, text, from }) {
  if (!to) {
    throw new Error('Email recipient is required');
  }
  if (!subject) {
    throw new Error('Email subject is required');
  }
  if (!html && !text) {
    throw new Error('Email body is required');
  }

  const smtpConfig = await getActiveSmtpSettings();
  if (!smtpConfig.IsActive) {
    return;
  }

  const transporter = buildTransporter(smtpConfig);

  await transporter.sendMail({
    from: from || smtpConfig.SmtpSender,
    to,
    subject,
    html,
    text,
  });
}

async function sendNewAccountEmail({ to, username, password, loginUrl }) {
  if (!to) {
    throw new Error('Recipient email is required for account notification');
  }

  const template = await loadTemplate('new_account.html');
  const compiled = handlebars.compile(template);
  const html = compiled({
    USERNAME: username,
    PASSWORD: password,
    URL: loginUrl,
  });

  const text = `ยินดีต้อนรับสู่ระบบ Agrofiber ERP\n\n` +
    `Username: ${username}\n` +
    `Password: ${password}\n` +
    `เข้าสู่ระบบได้ที่: ${loginUrl}\n\n` +
    `หากคุณไม่ได้ขอให้อีเมลฉบับนี้ โปรดติดต่อผู้ดูแลระบบ`;

  await sendEmail({
    to,
    subject: 'ยืนยันการสร้างบัญชีผู้ใช้งาน Agrofiber ERP',
    html,
    text,
  });
}

export default {
  sendNewAccountEmail,
};
