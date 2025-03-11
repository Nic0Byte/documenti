const signPDF = require('jsignpdf').default;
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');

// Funzione per trovare tutti i PDF nelle sottocartelle
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

// Funzione per aggiungere firma visibile
async function addVisibleSignature(pdfPath, signedPath, signerName) {
  const pdfBytes = fs.readFileSync(signedPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0]; // Firma sulla prima pagina

  // Testo della firma
  const text = `Firmato digitalmente da ${signerName}\nData: ${new Date().toISOString().replace("T", " ").split(".")[0]}`;

  firstPage.drawText(text, {
    x: 50,  // Posizione X della firma
    y: 50,  // Posizione Y della firma
    size: 14,
    color: rgb(0, 0, 0), // Colore nero
  });

  const modifiedPdfBytes = await pdfDoc.save();
  fs.writeFileSync(signedPath, modifiedPdfBytes);
  console.log(`DEBUG: Firma visibile aggiunta a ${signedPath}`);
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

      // Aggiungi la firma visibile
      await addVisibleSignature(filePath, signedFilePath, "Tuo Nome");
    } catch (err) {
      console.error(`DEBUG: Errore durante la firma del file ${filePath}:`, err);
      process.exit(1);
    }
  }

  console.log("DEBUG: Processo di firma completato per tutti i file.");
}

signFiles();
