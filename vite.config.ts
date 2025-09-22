import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import { builtinModules } from 'module'
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// 复制图标文件的插件
const copyAssetsPlugin = () => {
  return {
    name: 'copy-assets',
    writeBundle() {
      const srcDir = 'src/assets'
      const distDir = 'dist/assets'
      
      if (!existsSync(srcDir)) return
      
      // 确保目标目录存在
      if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true })
      }
      
      // 复制整个 assets 目录
      const copyDir = (src: string, dest: string) => {
        if (!existsSync(src)) return
        
        const items = readdirSync(src)
        items.forEach(item => {
          const srcPath = join(src, item)
          const destPath = join(dest, item)
          
          if (statSync(srcPath).isDirectory()) {
            if (!existsSync(destPath)) {
              mkdirSync(destPath, { recursive: true })
            }
            copyDir(srcPath, destPath)
          } else {
            copyFileSync(srcPath, destPath)
          }
        })
      }
      
      copyDir(srcDir, distDir)
      console.log('✅ 图标文件复制完成')
    }
  }
}

export default defineConfig({
  plugins: [
    copyAssetsPlugin(),
    electron({
      entry: 'src/main.ts',
      vite: {
        build: {
          outDir: 'dist',
          minify: 'terser',
          terserOptions: {
            compress: {
              // drop_console: true,
              // drop_debugger: true,
              // pure_funcs: ['console.log', 'console.info', 'console.debug'],
              passes: 2
            },
            mangle: {
              toplevel: true,
              reserved: ['__dirname', '__filename', 'require', 'module', 'exports']
            }
          },
          rollupOptions: {
            external: [
              ...builtinModules,
              'better-sqlite3',
              'typeorm',
              'fs-extra',
              'webdav',
              'reflect-metadata',
              '@node-rs/jieba',
              '@node-rs/jieba-wasm32-wasi',
              'pdfjs-dist',
              'electron',
              'electron-log',
              'electron-store',
              'electron-updater',
              'node-machine-id',
              'uuid',
              'class-validator',
              'ali-oss',
              'cos-nodejs-sdk-v5',
              'dotenv',
              'exif-reader',
              'iconv-lite',
              'mammoth',
              'pdf-parse',
              'pptx2json',
              'tslib',
              'xlsx',
              '@aws-sdk/client-s3',
              '@aws-sdk/s3-request-presigner'
            ],
            output: {
              format: 'cjs',
              entryFileNames: '[name].js',
              chunkFileNames: '[name].js',
              assetFileNames: '[name].[ext]'
            }
          }
        }
      }
    }),
    electron({
      entry: 'src/preload.ts',
      vite: {
        build: {
          outDir: 'dist',
          minify: 'terser',
          terserOptions: {
            compress: {
              // drop_console: true,
              // drop_debugger: true,
              // pure_funcs: ['console.log', 'console.info', 'console.debug'],
              passes: 2
            },
            mangle: {
              toplevel: true,
              reserved: ['__dirname', '__filename', 'require', 'module', 'exports']
            }
          },
          rollupOptions: {
            external: [
              ...builtinModules,
              '@node-rs/jieba',
              '@node-rs/jieba-wasm32-wasi',
              'pdfjs-dist',
              'electron'
            ],
            output: {
              format: 'cjs',
              entryFileNames: '[name].js',
              chunkFileNames: '[name].js',
              assetFileNames: '[name].[ext]'
            }
          }
        }
      }
    }),
    electron({
      entry: 'src/ipc/content-index/worker/file-index.worker.ts',
      vite: {
        build: {
          outDir: 'dist/worker',
          minify: 'terser',
          terserOptions: {
            compress: {
              passes: 2
            },
            mangle: {
              toplevel: true,
              reserved: ['__dirname', '__filename', 'require', 'module', 'exports']
            }
          },
          rollupOptions: {
            external: [
              ...builtinModules,
              'fast-glob',
              'fs-extra',
              'path',
              'os',
              'worker_threads'
            ],
            output: {
              format: 'cjs',
              entryFileNames: 'file-index.worker.js',
              chunkFileNames: '[name].js',
              assetFileNames: '[name].[ext]'
            }
          }
        }
      }
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        // drop_console: true,
        // drop_debugger: true,
        // pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2
      },
      mangle: {
        toplevel: true,
        reserved: ['__dirname', '__filename', 'require', 'module', 'exports']
      }
    },
    rollupOptions: {
      input: {
        main: 'src/main.ts',
        preload: 'src/preload.ts'
      },
      external: [
        ...builtinModules,
        '@node-rs/jieba',
        '@node-rs/jieba-wasm32-wasi',
        'pdfjs-dist',
        'electron'
      ]
    }
  },
  optimizeDeps: {
    include: ['webdav'],
    exclude: ['better-sqlite3', '@node-rs/jieba']
  }
})
