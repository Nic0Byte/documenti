const signPDF = require('jsignpdf').default;
const fs = require('fs');
const path = require('path');

// Funzione per trovare tutti i PDF in modo ricorsivo nelle sottocartelle
function getAllPDFs(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results = results.concat(getAllPDFs(filePath)); // Ricorsione nelle sottocartelle
    } else if (file.endsWith('.pdf') && !file.endsWith('_signed.pdf')) {
      results.push(filePath);
    }
  });

  return results;
}

async function signFiles() {
  const pdfDir = path.join(__dirname, 'documents');
  const files = getAllPDFs(pdfDir);

  console.log(`DEBUG: Trovati ${files.length} PDF da firmare.`);

  if (files.length === 0) {
    console.log("DEBUG: Nessun file PDF da firmare trovato.");
    return;
  }

  // Carica il certificato PKCS#12
  const certBuffer = fs.readFileSync(path.join(__dirname, 'certificate.p12'));
  const passphrase = process.env.SIGN_CERT_PASSWORD;

  console.log(`DEBUG: Certificato caricato, lunghezza buffer: ${certBuffer.length} bytes`);

  for (const filePath of files) {
    console.log(`DEBUG: Elaborazione file: ${filePath}`);

    try {
      const pdfBuffer = fs.readFileSync(filePath);
      console.log(`DEBUG: Lettura completata, dimensione: ${pdfBuffer.length} bytes`);

      // Opzioni per la firma digitale
      const options = { tsa: 'http://timestamp.digicert.com' };

      // Firma il PDF
      const signedBuffer = await signPDF(pdfBuffer, certBuffer, passphrase, options);
      console.log(`DEBUG: Firma completata, dimensione file firmato: ${signedBuffer.length} bytes`);

      // Salva il file firmato con suffisso "_signed.pdf"
      const signedFilePath = filePath.replace('.pdf', '_signed.pdf');
      fs.writeFileSync(signedFilePath, signedBuffer);
      console.log(`DEBUG: File firmato salvato: ${signedFilePath}`);

      // Rimuove il file originale
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
