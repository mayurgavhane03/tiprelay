FROM public.ecr.aws/lambda/python:3.11
COPY requirements.txt ${LAMBDA_TASK_ROOT}/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY voice.json download_voice.py ${LAMBDA_TASK_ROOT}/
RUN python download_voice.py /opt/voices
COPY synthesis.py worker.py ${LAMBDA_TASK_ROOT}/
ENV VOICE_PATH=/opt/voices/en_US-ljspeech-high.onnx
CMD ["worker.handler"]
