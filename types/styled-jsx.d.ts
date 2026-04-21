// Type declaration for styled-jsx support
// This allows `<style jsx>{`...`}</style>` and `<style jsx global>{`...`}</style>` syntax in TSX files

import 'react';

declare module 'react' {
  interface StyleHTMLAttributes<T> extends React.HTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}
