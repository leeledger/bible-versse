#!/bin/bash
# test-deploy.sh - 테스트 환경 관리 스크립트

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 함수: 테스트 환경 시작
start_test_env() {
  echo -e "${YELLOW}테스트 환경을 시작합니다...${NC}"
  docker-compose -f docker-compose.test.yml up --build -d
  
  echo -e "${YELLOW}데이터베이스 초기화를 기다립니다...${NC}"
  sleep 10
  
  echo -e "${GREEN}테스트 환경이 시작되었습니다.${NC}"
  echo -e "${GREEN}프론트엔드: http://localhost:5174${NC}"
  echo -e "${GREEN}백엔드: http://localhost:3002${NC}"
}

# 함수: 테스트 환경 중지
stop_test_env() {
  echo -e "${YELLOW}테스트 환경을 중지합니다...${NC}"
  docker-compose -f docker-compose.test.yml down
  echo -e "${GREEN}테스트 환경이 중지되었습니다.${NC}"
}

# 함수: 테스트 환경 재시작
restart_test_env() {
  stop_test_env
  start_test_env
}

# 함수: 로그 확인
view_logs() {
  if [ "$1" == "frontend" ]; then
    docker logs -f bible_frontend_test
  elif [ "$1" == "backend" ]; then
    docker logs -f bible_backend_test
  elif [ "$1" == "db" ]; then
    docker logs -f bible_postgres_db_test
  else
    echo -e "${RED}유효한 서비스 이름을 입력하세요 (frontend, backend, db)${NC}"
  fi
}

# 함수: 테스트 환경 정보 출력
show_info() {
  echo -e "${GREEN}테스트 환경 정보:${NC}"
  echo -e "${YELLOW}컨테이너 상태:${NC}"
  docker ps --filter "name=bible_*_test"
  
  echo -e "\n${YELLOW}네트워크:${NC}"
  docker network ls --filter "name=bible-reading-companion_test-network"
  
  echo -e "\n${YELLOW}볼륨:${NC}"
  docker volume ls --filter "name=bible-reading-companion_postgres_test_data"
}

# 함수: 테스트 환경 완전 삭제
clean_test_env() {
  echo -e "${YELLOW}테스트 환경을 완전히 삭제합니다...${NC}"
  docker-compose -f docker-compose.test.yml down -v
  echo -e "${GREEN}테스트 환경이 완전히 삭제되었습니다.${NC}"
}

# 메인 스크립트
case "$1" in
  start)
    start_test_env
    ;;
  stop)
    stop_test_env
    ;;
  restart)
    restart_test_env
    ;;
  logs)
    view_logs $2
    ;;
  info)
    show_info
    ;;
  clean)
    clean_test_env
    ;;
  *)
    echo -e "${GREEN}사용법:${NC}"
    echo -e "  $0 ${YELLOW}start${NC}    - 테스트 환경 시작"
    echo -e "  $0 ${YELLOW}stop${NC}     - 테스트 환경 중지"
    echo -e "  $0 ${YELLOW}restart${NC}  - 테스트 환경 재시작"
    echo -e "  $0 ${YELLOW}logs${NC} [frontend|backend|db] - 로그 확인"
    echo -e "  $0 ${YELLOW}info${NC}     - 테스트 환경 정보 출력"
    echo -e "  $0 ${YELLOW}clean${NC}    - 테스트 환경 완전 삭제"
    ;;
esac
