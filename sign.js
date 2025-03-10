const fs = require('fs');
const path = require('path');
const signPDF = require('jsignpdf');

async function signFiles() {
  const pdfDir = path.join(__dirname, 'documents');
  const files = fs.readdirSync(pdfDir).filter(file => file.endsWith('.pdf') && !file.endsWith('_signed.pdf'));

  // Decodifica il certificato dal secret (che è in base64)
  const certBuffer = Buffer.from(process.env.SIGN_CERT, 'base64');
  const passphrase = process.env.SIGN_CERT_PASSWORD;

  for (const file of files) {
    const filePath = path.join(pdfDir, file);
    const pdfBuffer = fs.readFileSync(filePath);
    try {
      // Personalizza le opzioni se necessario
      const options = {
        tsa: 'http://timestamp.digicert.com'
      };
      const signedBuffer = await signPDF(pdfBuffer, certBuffer, passphrase, options);
      const signedFilePath = filePath.replace('.pdf', '_signed.pdf');
      fs.writeFileSync(signedFilePath, signedBuffer);
      fs.unlinkSync(filePath);
      console.log(`Signed ${filePath} successfully.`);
    } catch (err) {
      console.error(`Failed to sign ${filePath}:`, err);
      process.exit(1);
    }
  }
}

signFiles();
