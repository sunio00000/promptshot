import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export async function saveImageToFile(buffer: Buffer, dir: string, opts?: { now?: Date }): Promise<string> {
  await mkdir(dir, { recursive: true })
  const base = stamp(opts?.now ?? new Date())
  let path = join(dir, `${base}.png`)
  let i = 2
  while (existsSync(path)) {
    path = join(dir, `${base}_${i}.png`)
    i++
  }
  await writeFile(path, buffer)
  return path
}

function stamp(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
}
