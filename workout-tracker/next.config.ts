import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/*': ['./prisma/dev.db', './prisma/schema.prisma'],
  },
};

export default nextConfig;
