# MinIO for Railway (and any platform that shell-wraps a "start command").
#
# The official minio/minio image is built on a shell-less UBI-micro base and its CMD is
# just `minio` (no subcommand). Railway's start-command override is shell-wrapped, so it
# can't exec on that base — the container exits before MinIO ever runs. Baking the full
# command here in exec-form (no shell) makes it start reliably. Configure via env:
#   MINIO_ROOT_USER / MINIO_ROOT_PASSWORD  (required, password >= 8 chars)
# Persist a volume at /data. Console on :9001, S3 API on :9000.
FROM minio/minio:latest
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
