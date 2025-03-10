// sign.js
const fs = require('fs');
const path = require('path');
const signPDF = require('jsignpdf');
const forge = require('node-forge');

async function signFiles() {
  const pdfDir = path.join(__dirname, 'documents');
  // Filtra i file PDF che non sono già firmati (non terminano con _signed.pdf)
  const files = fs.readdirSync(pdfDir).filter(file => file.endsWith('.pdf') && !file.endsWith('_signed.pdf'));
  
  console.log(`DEBUG: Trovati ${files.length} file PDF da firmare nella cartella ${pdfDir}`);
  
  // Decodifica il certificato PKCS#12 dal secret (in base64)
  const certBase64 = process.env.SIGN_CERT;
  const passphrase = process.env.SIGN_CERT_PASSWORD;
  if (!certBase64 || !passphrase) {
    console.error("DEBUG: Il certificato o la passphrase non sono impostati nelle variabili d'ambiente!");
    process.exit(1);
  }
  const certBuffer = Buffer.from(certBase64, 'base64');
  console.log(`DEBUG: Certificato decodificato, lunghezza buffer: ${certBuffer.length} bytes`);
  
  // Estrai e mostra alcuni dati dal certificato usando node-forge
  try {
    const binaryStr = certBuffer.toString('binary');
    const p12Asn1 = forge.asn1.fromDer(binaryStr);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certObj = bags[forge.pki.oids.certBag][0].cert;
    console.log("DEBUG: Certificate Subject Attributes:", certObj.subject.attributes);
  } catch (err) {
    console.error("DEBUG: Errore nell'estrazione dei dati dal certificato:", err);
  }
  
  for (const file of files) {
    const filePath = path.join(pdfDir, file);
    console.log(`DEBUG: Elaborazione file: ${filePath}`);
    let pdfBuffer;
    try {
      pdfBuffer = fs.readFileSync(filePath);
      console.log(`DEBUG: Lettura file completata, dimensione: ${pdfBuffer.length} bytes`);
    } catch (err) {
      console.error(`DEBUG: Errore nella lettura del file ${filePath}:`, err);
      continue;
    }
    
    try {
      console.log("DEBUG: Inizio firma del file...");
      const options = {
        tsa: 'http://timestamp.digicert.com'
        // Puoi aggiungere altre opzioni se necessario
      };
      const signedBuffer = await signPDF(pdfBuffer, certBuffer, passphrase, options);
      console.log(`DEBUG: Firma completata, dimensione file firmato: ${signedBuffer.length} bytes`);
      const signedFilePath = filePath.replace('.pdf', '_signed.pdf');
      fs.writeFileSync(signedFilePath, signedBuffer);
      console.log(`DEBUG: File firmato scritto: ${signedFilePath}`);
      fs.unlinkSync(filePath);
      console.log(`DEBUG: File originale rimosso: ${filePath}`);
    } catch (err) {
      console.error(`DEBUG: Errore durante la firma del file ${filePath}:`, err);
      process.exit(1);
    }
  }
  
  console.log("DEBUG: Processo di firma completato per tutti i file.");
}

signFiles();
