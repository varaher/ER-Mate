import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

export async function convertAudioToWav(audioBuffer: Buffer, originalFilename: string): Promise<{ buffer: Buffer; filename: string }> {
  const ext = path.extname(originalFilename).toLowerCase();
  
  if (ext === '.wav') {
    return { buffer: audioBuffer, filename: originalFilename };
  }

  const tmpDir = os.tmpdir();
  const timestamp = Date.now();
  const inputPath = path.join(tmpDir, `voice_input_${timestamp}${ext || '.bin'}`);
  const outputPath = path.join(tmpDir, `voice_output_${timestamp}.wav`);

  try {
    fs.writeFileSync(inputPath, audioBuffer);

    await execFileAsync('ffmpeg', [
      '-y',
      '-i', inputPath,
      '-ar', '16000',
      '-ac', '1',
      '-sample_fmt', 's16',
      '-f', 'wav',
      outputPath
    ], { timeout: 30000 });

    const wavBuffer = fs.readFileSync(outputPath);
    console.log(`[AudioConvert] Converted ${originalFilename} (${audioBuffer.length} bytes) -> WAV (${wavBuffer.length} bytes)`);
    return { buffer: wavBuffer, filename: originalFilename.replace(/\.[^.]+$/, '.wav') };
  } catch (error) {
    console.error('[AudioConvert] ffmpeg conversion failed:', error);
    console.log('[AudioConvert] Returning original audio as fallback');
    return { buffer: audioBuffer, filename: originalFilename };
  } finally {
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
  }
}
